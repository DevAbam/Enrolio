'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useRole } from '@/contexts/RoleContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { ImageUpload } from '@/components/ui/ImageUpload'

export default function SettingsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const { schoolId, reload } = useRole()

  const [name,    setName]    = useState('')
  const [address, setAddress] = useState('')
  const [phone,   setPhone]   = useState('')
  const [email,   setEmail]   = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    if (!schoolId) return
    setLoading(true)
    const { data } = await supabase.from('schools').select('name, logo_url, address, phone, email').eq('id', schoolId).single()
    if (data) {
      setName(data.name ?? '')
      setLogoUrl(data.logo_url ?? null)
      setAddress((data as any).address ?? '')
      setPhone((data as any).phone ?? '')
      setEmail((data as any).email ?? '')
    }
    setLoading(false)
  }, [supabase, schoolId])

  useEffect(() => { load() }, [load])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function handleSave() {
    if (!schoolId || !name.trim()) { toast.error('School name is required'); return }
    setSaving(true)
    const { error } = await supabase
      .from('schools')
      .update({ name: name.trim(), logo_url: logoUrl, address: address.trim() || null, phone: phone.trim() || null, email: email.trim() || null })
      .eq('id', schoolId)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('School settings saved')
    reload()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="School Settings" subtitle="Manage your school's profile and branding" />

      {loading ? (
        <div className="card animate-pulse h-64" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

          {/* Logo card */}
          <div className="card p-6 flex flex-col items-center text-center gap-4">
            <ImageUpload
              currentUrl={logoUrl}
              folder="SchoolOps/schools"
              initials="S"
              size={160}
              shape="square"
              onUpload={async (url) => {
                setLogoUrl(url)
                if (!schoolId) return
                const { error } = await supabase.from('schools').update({ logo_url: url }).eq('id', schoolId)
                if (error) { toast.error('Failed to save logo: ' + error.message); return }
                reload()
              }}
            />
            <div>
              <p className="text-sm font-medium text-fg">{name || 'Your School'}</p>
              <p className="text-xs text-fg-muted mt-1">Click the image to upload a new logo</p>
            </div>
          </div>

          {/* Details card */}
          <div className="space-y-6">
            <div className="card p-6 space-y-5">
              <h3 className="font-semibold text-fg border-b border-border pb-3">School Information</h3>

              <div>
                <label className="label">School Name *</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bright Future Academy"
                />
              </div>

              <div>
                <label className="label">Address</label>
                <input
                  className="input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street, Accra"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Phone</label>
                  <input
                    className="input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 20 000 0000"
                  />
                </div>
                <div>
                  <label className="label">School Email</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@school.com"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button loading={saving} onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Account */}
            <div className="card p-6 space-y-4">
              <h3 className="font-semibold text-fg border-b border-border pb-3">Account</h3>
              <p className="text-sm text-fg-muted">Sign out of your account on this device.</p>
              <Button
                variant="ghost"
                icon={<LogOut size={15} />}
                onClick={handleLogout}
                className="text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
