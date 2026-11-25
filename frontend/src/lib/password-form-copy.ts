export function passwordFormCopy(token: string, locale: string) {
    const spanish = locale === "es";
    if (token.startsWith("whi_")) {
        return {
            error: spanish ? "No se pudo activar la cuenta." : "Could not activate the account.",
            success: spanish ? "Cuenta activada" : "Account activated",
            confirmation: spanish ? "Ya puedes iniciar sesión con el correo de la invitación y tu contraseña." : "You can now sign in with the invited email address and your password.",
            title: spanish ? "Crear contraseña" : "Create password",
            description: spanish ? "Elige tu contraseña para activar tu acceso al equipo técnico de WorkHive." : "Choose a password to activate your WorkHive technical team account.",
            submit: spanish ? "Crear contraseña" : "Create password",
        };
    }
    return {
        error: spanish ? "No se pudo restablecer la contraseña." : "Error resetting password",
        success: spanish ? "Contraseña Cambiada" : "Password Changed",
        confirmation: spanish ? "Tu contraseña ha sido restablecida con éxito. Redirigiendo al inicio de sesión..." : "Your password has been successfully reset. Redirecting to login...",
        title: spanish ? "Nueva contraseña" : "New Password",
        description: spanish ? "Elige una contraseña nueva y segura de al menos 8 caracteres." : "Choose a new secure password of at least 8 characters.",
        submit: spanish ? "Restablecer contraseña" : "Reset Password",
    };
}
