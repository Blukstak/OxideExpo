use crate::config::Config;
use lettre::{
    message::header::ContentType, transport::smtp::authentication::Credentials, AsyncSmtpTransport,
    AsyncTransport, Message, Tokio1Executor,
};

#[derive(Clone)]
pub struct EmailService {
    mailer: AsyncSmtpTransport<Tokio1Executor>,
    from_address: String,
    frontend_url: String,
}

impl EmailService {
    pub fn new(config: &Config) -> Result<Self, Box<dyn std::error::Error>> {
        let mailer = if config.smtp_user.is_some() && config.smtp_password.is_some() {
            // Authenticated SMTP
            let creds = Credentials::new(
                config.smtp_user.clone().unwrap(),
                config.smtp_password.clone().unwrap(),
            );
            AsyncSmtpTransport::<Tokio1Executor>::relay(&config.smtp_host)?
                .port(config.smtp_port)
                .credentials(creds)
                .build()
        } else {
            // Unauthenticated SMTP (for Mailhog in development)
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.smtp_host)
                .port(config.smtp_port)
                .build()
        };

        Ok(Self {
            mailer,
            from_address: config.smtp_from.clone(),
            frontend_url: config.frontend_url.clone(),
        })
    }

    pub async fn send_verification_email(
        &self,
        to: &str,
        name: &str,
        token: &str,
    ) -> Result<(), EmailError> {
        let verification_url = format!("{}/auth/verify-email?token={}", self.frontend_url, token);

        let body = format!(
            r#"Hola {},

Gracias por registrarte en EmpleosInclusivos.

Para verificar tu cuenta, haz clic en el siguiente enlace:
{}

Este enlace expirará en 24 horas.

Si no creaste esta cuenta, puedes ignorar este correo.

Saludos,
El equipo de EmpleosInclusivos"#,
            name, verification_url
        );

        self.send_email(to, "Verifica tu cuenta - EmpleosInclusivos", &body)
            .await
    }

    pub async fn send_password_reset_email(
        &self,
        to: &str,
        name: &str,
        token: &str,
    ) -> Result<(), EmailError> {
        let reset_url = format!("{}/auth/reset-password?token={}", self.frontend_url, token);

        let body = format!(
            r#"Hola {},

Recibimos una solicitud para restablecer tu contraseña.

Para crear una nueva contraseña, haz clic en el siguiente enlace:
{}

Este enlace expirará en 1 hora.

Si no solicitaste este cambio, puedes ignorar este correo y tu contraseña permanecerá igual.

Saludos,
El equipo de EmpleosInclusivos"#,
            name, reset_url
        );

        self.send_email(to, "Restablece tu contraseña - EmpleosInclusivos", &body)
            .await
    }

    pub async fn send_application_received_email(
        &self,
        to: &str,
        name: &str,
        job_title: &str,
        company_name: &str,
    ) -> Result<(), EmailError> {
        let body = format!(
            r#"Hola {},

Tu postulación al puesto de {} en {} ha sido recibida exitosamente.

Pronto recibirás noticias sobre el proceso de selección.

Puedes revisar el estado de tus postulaciones en tu panel de control.

Saludos,
El equipo de EmpleosInclusivos"#,
            name, job_title, company_name
        );

        self.send_email(to, &format!("Postulación recibida: {}", job_title), &body)
            .await
    }

    async fn send_email(&self, to: &str, subject: &str, body: &str) -> Result<(), EmailError> {
        let email = Message::builder()
            .from(self.from_address.parse().map_err(|_| EmailError::InvalidFromAddress)?)
            .to(to.parse().map_err(|_| EmailError::InvalidToAddress)?)
            .subject(subject)
            .header(ContentType::TEXT_PLAIN)
            .body(body.to_string())
            .map_err(|e| EmailError::BuildError(e.to_string()))?;

        self.mailer
            .send(email)
            .await
            .map_err(|e| EmailError::SendError(e.to_string()))?;

        tracing::info!("Email sent to {}: {}", to, subject);
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("Invalid from address")]
    InvalidFromAddress,

    #[error("Invalid to address")]
    InvalidToAddress,

    #[error("Failed to build email: {0}")]
    BuildError(String),

    #[error("Failed to send email: {0}")]
    SendError(String),
}
