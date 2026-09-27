# Production document storage

This runbook governs the S3 bucket used by WorkHive application documents:
invoices, Facturae files, fiscal certificates owned by a company, reports, and
uploaded media. It deliberately does not govern the backup bucket described in
`ops/backup/README.md` and the AWS operations runbook.

It is safe to keep this document in Git: it contains no bucket name, account
identifier, certificate, password, access key, or secret ARN.

## Boundary

Use a dedicated private bucket for application documents. Do not reuse the
write-only backup bucket: the application runtime has to read authorized
documents, whereas the production backup role must stay unable to read or
delete recovery data.

The application stores opaque object keys and document metadata in the
database. Authorization remains an application concern; an S3 key is never a
public URL or a tenant permission.

## Required bucket controls

Before setting `MEDIA_STORAGE_BACKEND=s3` for production, configure the
document bucket with all of the following controls:

1. Block all public access and disable ACL-based ownership. No public bucket
   policy, public ACL, website endpoint, or anonymous object access is allowed.
2. Enable versioning. It preserves a recoverable version when an application
   update or deletion writes a newer version or a delete marker.
3. Enable default server-side encryption. S3-managed encryption is sufficient
   unless a reviewed customer or compliance obligation requires a customer
   managed key.
4. Deny unencrypted transport at the bucket boundary. Requests must use TLS.
5. Add a lifecycle rule that removes incomplete multipart uploads after a short
   interval. It prevents abandoned uploads from accumulating.
6. Do not configure automatic expiry for current fiscal or contractual
   documents. Their retention and deletion are business and legal decisions,
   not a storage-cost shortcut.
7. Set a reviewed lifecycle period for noncurrent versions and delete markers.
   Record the approved period with the fiscal/document-retention policy before
   enabling it. A lifecycle rule must not make the only recoverable version
   disappear before the agreed recovery window.

## Runtime access

Attach a dedicated production instance role to the application host. Grant it
only the document-bucket object actions required by the configured storage
backend, scoped to that bucket. It must not grant broad `s3:*`, access to the
backup bucket, or the ability to remove object versions.

The global Facturae signer may use a separate AWS Secrets Manager reference.
When it is enabled, grant that same runtime role only
`secretsmanager:GetSecretValue` for the one approved secret. The secret value
is a JSON object with `pkcs12_base64` and `password`; configure only its
reference in the deployment environment. Never put the PKCS#12 file or its
password in Git, a Docker image, or the database.

Use exactly one signing source: the Secrets Manager reference in production or
the legacy filesystem certificate for local compatibility. WorkHive rejects a
configuration that supplies both.

## Deployment verification

After an authorized infrastructure change, validate from the production runtime
without printing its environment:

1. Confirm the document bucket has public-access blocking, versioning,
   encryption, TLS-only access, and the reviewed lifecycle rules.
2. Confirm the runtime role can write and read a test object in the document
   bucket but cannot access backup objects or object versions.
3. Generate an authorized invoice PDF and unsigned Facturae document, then
   download both through WorkHive and compare their recorded hashes.
4. If global Facturae signing is enabled, issue one controlled signed document.
   Confirm the result is signed and that logs contain neither the certificate
   material nor its password.
5. Run the legacy-document migration in dry-run mode for one approved company.
   Apply it only after the report, object readback, and hashes are reviewed.
6. Record the bucket configuration and validation evidence in the private
   production change record, never in this repository.

If any check fails, leave the application on its prior document source and
investigate before migrating production records.
