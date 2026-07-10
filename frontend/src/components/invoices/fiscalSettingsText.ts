export type FiscalSettingsText = {
    loading: string;
    loadError: string;
    updateError: string;
    certificateSaved: string;
    certificateSaveError: string;
    ready: string;
    incomplete: string;
    validateError: string;
    title: string;
    readyBadge: string;
    incompleteBadge: string;
    production: string;
    test: string;
    certificateLoaded: string;
    missing: string;
    configure: string;
    validate: string;
    dialogDescription: string;
    fileHelpTitle: string;
    fileHelpBody: string;
    fileHelpStorage: string;
    activateCompany: string;
    productionOption: string;
    testOption: string;
    selectCertificate: string;
    noCertificate: string;
    passwordPlaceholder: string;
    close: string;
    saveCertificate: string;
    validateAeat: string;
    environmentAriaLabel: string;
};

const FISCAL_SETTINGS_TEXT_EN: FiscalSettingsText = {
    loading: "Loading AEAT settings",
    loadError: "Could not load AEAT",
    updateError: "Could not update AEAT",
    certificateSaved: "AEAT certificate saved",
    certificateSaveError: "Could not save the certificate",
    ready: "AEAT settings ready",
    incomplete: "AEAT settings incomplete",
    validateError: "Could not validate AEAT",
    title: "AEAT / VERI*FACTU connection",
    readyBadge: "Ready",
    incompleteBadge: "Incomplete",
    production: "Production",
    test: "Test",
    certificateLoaded: "Certificate uploaded",
    missing: "Missing",
    configure: "Configure AEAT",
    validate: "Validate",
    dialogDescription: "Configure this company's digital certificate to submit VERI*FACTU records.",
    fileHelpTitle: "What file is selected",
    fileHelpBody: "Company/self-employed digital certificate in PKCS#12 format: `.p12` or `.pfx`. The backend validates that it contains a private key and certificate.",
    fileHelpStorage: "It is stored per company in `FISCAL_CERTIFICATE_STORAGE_PATH`; the password is encrypted.",
    activateCompany: "Activate company",
    productionOption: "Production AEAT",
    testOption: "Test AEAT",
    selectCertificate: "Select .p12 / .pfx certificate",
    noCertificate: "No certificate selected",
    passwordPlaceholder: "Certificate password",
    close: "Close",
    saveCertificate: "Save certificate",
    validateAeat: "Validate AEAT",
    environmentAriaLabel: "AEAT environment",
};

const FISCAL_SETTINGS_TEXT_ES: FiscalSettingsText = {
    loading: "Cargando configuración AEAT",
    loadError: "No se pudo cargar AEAT",
    updateError: "No se pudo actualizar AEAT",
    certificateSaved: "Certificado AEAT guardado",
    certificateSaveError: "No se pudo guardar el certificado",
    ready: "Configuración AEAT lista",
    incomplete: "Configuración AEAT incompleta",
    validateError: "No se pudo validar AEAT",
    title: "Conexión AEAT / VERI*FACTU",
    readyBadge: "Listo",
    incompleteBadge: "Incompleto",
    production: "Producción",
    test: "Test",
    certificateLoaded: "Certificado cargado",
    missing: "Falta",
    configure: "Configurar AEAT",
    validate: "Validar",
    dialogDescription: "Configura el certificado digital de esta empresa para poder enviar registros VERI*FACTU.",
    fileHelpTitle: "Qué archivo se selecciona",
    fileHelpBody: "Certificado digital de empresa/autónomo en formato PKCS#12: `.p12` o `.pfx`. El backend valida que tenga clave privada y certificado.",
    fileHelpStorage: "Se guarda por empresa en `FISCAL_CERTIFICATE_STORAGE_PATH`; la contraseña queda cifrada.",
    activateCompany: "Activar empresa",
    productionOption: "Producción AEAT",
    testOption: "Test AEAT",
    selectCertificate: "Seleccionar certificado .p12 / .pfx",
    noCertificate: "Ningún certificado seleccionado",
    passwordPlaceholder: "Contraseña del certificado",
    close: "Cerrar",
    saveCertificate: "Guardar certificado",
    validateAeat: "Validar AEAT",
    environmentAriaLabel: "Entorno AEAT",
};

export function getFiscalSettingsText(locale: string): FiscalSettingsText {
    return locale === "en" ? FISCAL_SETTINGS_TEXT_EN : FISCAL_SETTINGS_TEXT_ES;
}
