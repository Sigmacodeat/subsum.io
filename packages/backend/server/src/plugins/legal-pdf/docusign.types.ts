export type DocuSignSignerInput = {
  name: string;
  email: string;
};

export type DocuSignStartSigningRequest = {
  workspaceId: string;
  /** Workspace blob key of the PDF to sign */
  blobKey: string;
  title: string;
  signer: DocuSignSignerInput;
  /** Absolute URL where DocuSign redirects the user after signing */
  returnUrl: string;
};

export type DocuSignStartSigningResponse =
  | {
      ok: true;
      signingRequestId: string;
      envelopeId: string;
      recipientViewUrl: string;
    }
  | {
      ok: false;
      code: 'forbidden' | 'invalid_input' | 'provider_not_configured' | 'provider_error';
      message: string;
    };

export type DocuSignFinalizeSigningRequest = {
  workspaceId: string;
  signingRequestId: string;
};

export type DocuSignFinalizeSigningResponse =
  | {
      ok: true;
      status: 'completed' | 'pending';
      signedBlobKey?: string;
      signedDocId?: string;
    }
  | {
      ok: false;
      code: 'forbidden' | 'not_found' | 'provider_not_configured' | 'provider_error';
      message: string;
    };

export type StoredDocuSignRequest = {
  signingRequestId: string;
  workspaceId: string;
  blobKey: string;
  title: string;
  signerName: string;
  signerEmail: string;
  envelopeId: string;
  createdAt: string;
  updatedAt: string;
  status: 'created' | 'sent' | 'completed' | 'failed';
  signedBlobKey?: string;
  signedDocId?: string;
};
