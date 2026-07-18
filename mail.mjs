import process from 'node:process'

export async function sendVerificationEmail(email, code) {
  const provider = process.env.EMAIL_PROVIDER || 'resend'
  const fromAddress = process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const apiKey = process.env.RESEND_API_KEY
  const isConfigured = Boolean(apiKey)

  if (!isConfigured) {
    return {
      success: true,
      provider: 'local-fallback',
      message: `Verification code ${code} for ${email} (email delivery skipped because RESEND_API_KEY is not configured)`,
    }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const response = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: 'Verify your interview account',
      html: `<p>Your verification code is <strong>${code}</strong>.</p>`,
    })

    return { success: true, provider, messageId: response.data?.id || null }
  } catch (error) {
    return {
      success: false,
      provider,
      message: error instanceof Error ? error.message : 'Unable to send email',
    }
  }
}
