import { describe, expect, it } from 'vitest';
import { PdfTextExtractionError, textFromPdfTextArtifact } from './pdf-text-extractor.js';

const PDF_BASE64 = 'JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA2MTIgNzkyIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwODI4MTMwOTI2KzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwODI4MTMwOTI2KzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovTGVuZ3RoIDE2NQo+PgpzdHJlYW0KMSAwIDAgMSAwIDAgY20gIEJUIC9GMSAxMiBUZiAxNC40IFRMIEVUCkJUIC9GMSAxMiBUZiAxNC40IFRMIEVUCkJUIDEgMCAwIDEgNzIgNzIwIFRtIChXYXN0ZVBMIFBERl9URVhUIHNtb2tlKSBUaiBUKiBFVApCVCAxIDAgMCAxIDcyIDcwMCBUbSAoc2Vjb25kIGxpbmUpIFRqIFQqIEVUCiAKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDA5MiAwMDAwMCBuIAowMDAwMDAwMTk5IDAwMDAwIG4gCjAwMDAwMDAzOTIgMDAwMDAgbiAKMDAwMDAwMDQ2MCAwMDAwMCBuIAowMDAwMDAwNzIxIDAwMDAwIG4gCjAwMDAwMDA3ODAgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8YmE0Nzk3NzczZGQyYWVhMWUzNjg0YmFmNDg0MjNiZWI+PGJhNDc5Nzc3M2RkMmFlYTFlMzY4NGJhZjQ4NDIzYmViPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA1IDAgUgovUm9vdCA0IDAgUgovU2l6ZSA4Cj4+CnN0YXJ0eHJlZgo5OTUKJSVFT0YK';

describe('textFromPdfTextArtifact', () => {
  it('extracts line-oriented text from raw PDF bytes', async () => {
    const text = await textFromPdfTextArtifact(Buffer.from(PDF_BASE64, 'base64'));
    expect(text).toContain('WastePL PDF_TEXT smoke');
    expect(text).toContain('second line');
  }, 20_000);

  it('keeps historical UTF-8 text fixtures supported', async () => {
    await expect(textFromPdfTextArtifact(Buffer.from('Gmina Manowo\nstyczeń 1 2')))
      .resolves.toBe('Gmina Manowo\nstyczeń 1 2');
  });

  it('fails visibly when a PDF has no extractable text', async () => {
    // Truncate a real PDF after its header so detection takes the PDF parser path.
    await expect(textFromPdfTextArtifact(Buffer.from('%PDF-1.7\nbroken')))
      .rejects.toBeInstanceOf(PdfTextExtractionError);
  });
});
