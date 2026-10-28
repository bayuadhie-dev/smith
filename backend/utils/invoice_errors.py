class InvoiceInputError(ValueError):
    """Kesalahan input/aturan bisnis saat membuat faktur; status = kode HTTP untuk endpoint."""
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status
