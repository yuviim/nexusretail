import { TextractClient, AnalyzeExpenseCommand } from '@aws-sdk/client-textract';

const textract = new TextractClient({ region: process.env.AWS_REGION || 'eu-central-1' });

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  totalPrice: number | null;
}

export interface ExtractedInvoice {
  vendorName: string | null;
  invoiceDate: string | null;
  totalAmount: number | null;
  poNumber: string | null;
  lineItems: ExtractedLineItem[];
}

export async function extractInvoice(s3Bucket: string, s3Key: string): Promise<ExtractedInvoice> {
  const command = new AnalyzeExpenseCommand({
    Document: {
      S3Object: { Bucket: s3Bucket, Name: s3Key },
    },
  });

  const response = await textract.send(command);
  const doc = response.ExpenseDocuments?.[0];

  if (!doc) {
    throw new Error('Textract returned no expense document — check the file is a valid invoice/receipt image or PDF');
  }

  const summaryFields = doc.SummaryFields ?? [];
  const getSummaryValue = (type: string) =>
    summaryFields.find((f) => f.Type?.Text === type)?.ValueDetection?.Text ?? null;

  const vendorName = getSummaryValue('VENDOR_NAME');
  const invoiceDate = getSummaryValue('INVOICE_RECEIPT_DATE');
  const poNumber = getSummaryValue('PO_NUMBER');
  const totalRaw = getSummaryValue('TOTAL');
  const totalAmount = totalRaw ? parseFloat(totalRaw.replace(/[^0-9.]/g, '')) : null;

  const lineItems: ExtractedLineItem[] = (doc.LineItemGroups ?? []).flatMap((group) =>
    (group.LineItems ?? []).map((item) => {
      const fields = item.LineItemExpenseFields ?? [];
      const getField = (type: string) =>
        fields.find((f) => f.Type?.Text === type)?.ValueDetection?.Text ?? null;

      const parseNum = (val: string | null) => (val ? parseFloat(val.replace(/[^0-9.]/g, '')) : null);

      return {
        description: getField('ITEM') ?? 'Unknown item',
        quantity: parseNum(getField('QUANTITY')),
        unitPrice: parseNum(getField('UNIT_PRICE')),
        totalPrice: parseNum(getField('PRICE')),
      };
    })
  );

  return { vendorName, invoiceDate, totalAmount, poNumber, lineItems };
}
