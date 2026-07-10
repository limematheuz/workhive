from lxml import etree
from signxml import DigestAlgorithm, SignatureMethod, methods
from signxml.xades import (
    XAdESDataObjectFormat,
    XAdESSignaturePolicy,
    XAdESSigner,
)

from app.integrations.aeat.certificate import load_pkcs12_credentials


POLICY_IDENTIFIER = (
    "https://www.facturae.gob.es/content/dam/facturae/formato/"
    "polticasfirma/a)-versión-3-1/Politica_Firma_formato_facturae_v3_1.pdf"
)
POLICY_DIGEST_SHA256 = "a/vDoueJq9zxWGCFwdsXdlXtkFSEek4XVtmlQCEDaE8="


def sign_facturae_xml(
    xml: bytes,
    *,
    certificate_path: str,
    certificate_password: str,
) -> bytes:
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    document = etree.fromstring(xml, parser)
    private_key, certificate, chain = load_pkcs12_credentials(
        certificate_path,
        certificate_password,
    )
    signer = XAdESSigner(
        signature_policy=XAdESSignaturePolicy(
            Identifier=POLICY_IDENTIFIER,
            Description="Política de firma electrónica para Facturae 3.1",
            DigestMethod=DigestAlgorithm.SHA256,
            DigestValue=POLICY_DIGEST_SHA256,
        ),
        claimed_roles=["supplier"],
        data_object_format=XAdESDataObjectFormat(
            Description="Factura electrónica Facturae 3.2.2",
            MimeType="text/xml",
        ),
        method=methods.enveloped,
        signature_algorithm=SignatureMethod.RSA_SHA256,
        digest_algorithm=DigestAlgorithm.SHA256,
    )
    signed = signer.sign(
        document,
        key=private_key,
        cert=[certificate, *chain],
    )
    return etree.tostring(
        signed,
        encoding="UTF-8",
        xml_declaration=True,
        pretty_print=True,
    )
