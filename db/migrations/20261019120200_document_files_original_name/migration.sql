-- Las filas que ya existen quedan con NULL: su nombre original nunca llegó a la base.
ALTER TABLE "document_files" ADD COLUMN "original_name" TEXT;

ALTER TABLE "document_files" ADD CONSTRAINT "document_files_original_name_length"
    CHECK ("original_name" IS NULL OR char_length("original_name") BETWEEN 1 AND 255);
