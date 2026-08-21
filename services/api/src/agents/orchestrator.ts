import {
    BedrockRuntimeClient,
    ConverseCommand,
    type Message,
    type Tool,
  } from '@aws-sdk/client-bedrock-runtime';
  import { extractInvoice } from './tools/extractInvoice';
  import { matchPurchaseOrder } from './tools/matchPurchaseOrder';
  import { updateStock } from './tools/updateStock';
  
  const bedrock = new BedrockRuntimeClient({ region: 'eu-central-1' });
  const MODEL_ID = 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0';

  const tools: Tool[] = [
    {
      toolSpec: {
        name: 'extract_invoice',
        description: 'Extract vendor, date, total, and line items from an invoice PDF stored in S3.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              bucket: { type: 'string' },
              key: { type: 'string' },
            },
            required: ['bucket', 'key'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'match_purchase_order',
        description: 'Compare extracted invoice line items against an open purchase order. Returns matched or flagged status.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
              purchaseOrderId: { type: 'string' },
              invoice: { type: 'object' },
            },
            required: ['tenantId', 'purchaseOrderId', 'invoice'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'update_stock',
        description: 'Update inventory stock levels once a purchase order has been confirmed as matched. Only call this if match status was "matched", never on "flagged".',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              tenantId: { type: 'string' },
              purchaseOrderId: { type: 'string' },
            },
            required: ['tenantId', 'purchaseOrderId'],
          },
        },
      },
    },
  ];
  
  async function executeTool(name: string, input: any): Promise<any> {
    switch (name) {
      case 'extract_invoice':
        return extractInvoice(input.bucket, input.key);
      case 'match_purchase_order':
        return matchPurchaseOrder(input.tenantId, input.purchaseOrderId, input.invoice);
      case 'update_stock':
        return updateStock(input.tenantId, input.purchaseOrderId);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  export async function runInvoiceOrchestrator(params: {
    tenantId: string;
    purchaseOrderId: string;
    s3Bucket: string;
    s3Key: string;
  }) {
    const messages: Message[] = [
      {
        role: 'user',
        content: [
          {
            text: `Process this supplier invoice. Steps: 1) extract the invoice from S3 bucket "${params.s3Bucket}", key "${params.s3Key}". 2) match it against purchase order "${params.purchaseOrderId}" for tenant "${params.tenantId}". 3) only if the match status is "matched", update stock levels for that same purchase order and tenant. If the match is "flagged", stop and report the mismatch details instead of updating stock.`,
          },
        ],
      },
    ];
  
    const log: { tool: string; input: any; output: any }[] = [];
  
    for (let turn = 0; turn < 6; turn++) {
      const response = await bedrock.send(
        new ConverseCommand({
          modelId: MODEL_ID,
          messages,
          toolConfig: { tools },
        })
      );
  
      const output = response.output?.message;
      if (!output) throw new Error('No response from model');
      messages.push(output);
  
      const toolUse = output.content?.find((c) => 'toolUse' in c)?.toolUse;
  
      if (!toolUse) {
        const finalText = output.content?.find((c) => 'text' in c)?.text;
        return { summary: finalText, log };
      }
  
      const result = await executeTool(toolUse.name!, toolUse.input);
      log.push({ tool: toolUse.name!, input: toolUse.input, output: result });
  
      messages.push({
        role: 'user',
        content: [
          {
            toolResult: {
              toolUseId: toolUse.toolUseId,
              content: [{ json: result }],
            },
          },
        ],
      });
    }
  
    throw new Error('Orchestrator exceeded maximum turns without completing');
  }