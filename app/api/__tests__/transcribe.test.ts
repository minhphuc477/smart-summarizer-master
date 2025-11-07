// Mock groq-sdk before importing the route
jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'transcribed text' })
      }
    }
  }))
}));

let transcribePOST: (req: Request) => Promise<Response>;
beforeAll(async () => {
  ({ POST: transcribePOST } = await import('../transcribe/route'));
});

describe('POST /api/transcribe', () => {
  const mockRequest = (formData: FormData) => ({
    formData: jest.fn().mockResolvedValue(formData),
    url: 'http://localhost:3000/api/transcribe',
    headers: new Headers(),
    method: 'POST'
  } as unknown as Request);

  test('requires audio file', async () => {
    const formData = new FormData();
    const req = mockRequest(formData);
    const response = await transcribePOST(req);
    expect(response.status).toBe(400);
  });

  test('accepts valid audio file', async () => {
    const formData = new FormData();
    const blob = new Blob(['fake audio data'], { type: 'audio/webm' });
    formData.append('file', blob, 'recording.webm');
    
    const req = mockRequest(formData);
    const response = await transcribePOST(req);
    
  expect(response.status).toBe(200);
  });
});
