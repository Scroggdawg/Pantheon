export async function POST(request: Request) {
  const { password } = await request.json()

  if (password !== process.env.PANTHEON_PASSWORD) {
    return Response.json({ error: 'wrong' }, { status: 401 })
  }

  const response = Response.json({ ok: true })
  response.headers.set(
    'Set-Cookie',
    `pantheon_session=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  )
  return response
}
