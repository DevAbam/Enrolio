import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Public endpoint — generates ImageKit upload auth params.
// No user auth required; ImageKit's private key controls upload access.
export async function GET() {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY
  if (!privateKey) {
    return NextResponse.json({ error: 'ImageKit not configured' }, { status: 500 })
  }

  const token  = crypto.randomUUID()
  const expire = Math.floor(Date.now() / 1000) + 3600
  const signature = crypto
    .createHmac('sha1', privateKey)
    .update(token + expire)
    .digest('hex')

  return NextResponse.json({ token, expire, signature })
}
