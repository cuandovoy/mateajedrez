/**
 * Seeder: Crea 2 organizaciones y 2 usuarios en Supabase.
 *
 * Requiere en .env:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (Dashboard > Project Settings > API > service_role)
 *
 * Ejecutar: yarn seed
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env')
    const content = readFileSync(envPath, 'utf-8')
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const eq = trimmed.indexOf('=')
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim()
          const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = val
        }
      }
    })
  } catch (_) {}
}
loadEnv()

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const USERS = [
  { email: 'lucasciceri59@gmail.com', fullName: 'Lucas Ciceri', orgName: 'Org Lucas', orgSlug: 'org-lucas' },
  { email: 'ciceridev@gmail.com', fullName: 'Ciceri Dev', orgName: 'Org Ciceri', orgSlug: 'org-ciceri' },
]

const DEFAULT_PASSWORD = 'TempPassword123!'

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Faltan variables de entorno:')
    console.error('   VITE_SUPABASE_URL o SUPABASE_URL')
    console.error('   SUPABASE_SERVICE_ROLE_KEY (clave desde Dashboard > Settings > API > service_role)')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  console.log('🌱 Iniciando seed...\n')

  const createdUserIds = []

  // 1. Crear usuarios en Auth
  for (const user of USERS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        console.log(`⚠️  Usuario ${user.email} ya existe, buscando id...`)
        const { data: existing } = await supabase.auth.admin.listUsers()
        const found = existing?.users?.find((u) => u.email === user.email)
        if (found) createdUserIds.push(found.id)
        continue
      }
      console.error(`❌ Error creando ${user.email}:`, error.message)
      process.exit(1)
    }

    if (data?.user?.id) {
      createdUserIds.push(data.user.id)
      console.log(`✅ Usuario creado: ${user.email}`)
    }
  }

  // Esperar a que los triggers se ejecuten (user_profiles, organization_members)
  await new Promise((r) => setTimeout(r, 1500))

  // 2. Obtener org default
  const { data: defaultOrg, error: defaultOrgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'default')
    .single()

  if (defaultOrgError || !defaultOrg) {
    console.error('❌ No se encontró la organización default. Ejecuta las migraciones primero.')
    process.exit(1)
  }

  // 3. Crear segunda organización
  const { data: org2, error: org2Error } = await supabase
    .from('organizations')
    .insert({
      name: USERS[1].orgName,
      slug: USERS[1].orgSlug,
      subscription_tier: 'free',
      subscription_status: 'active',
    })
    .select('id')
    .single()

  let org2Id = org2?.id

  if (org2Error) {
    if (org2Error.code === '23505') {
      console.log('⚠️  Org "org-ciceri" ya existe')
      const { data: existing } = await supabase.from('organizations').select('id').eq('slug', USERS[1].orgSlug).single()
      org2Id = existing?.id
    } else {
      console.error('❌ Error creando org 2:', org2Error.message)
      process.exit(1)
    }
  }

  if (!org2Id) {
    console.error('❌ No se pudo obtener id de org 2')
    process.exit(1)
  }

  console.log(`✅ Organización: ${USERS[1].orgName} (${USERS[1].orgSlug})`)

  // 4. Completar user ids si faltan (usuarios preexistentes)
  if (createdUserIds.length < 2) {
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 100 })
    const users = listData?.users || []
    const user1 = users.find((u) => u.email === USERS[0].email)
    const user2 = users.find((u) => u.email === USERS[1].email)
    if (user1 && !createdUserIds[0]) createdUserIds[0] = user1.id
    if (user2 && !createdUserIds[1]) createdUserIds[1] = user2.id
  }

  if (!createdUserIds[0] || !createdUserIds[1]) {
    console.error('❌ No se pudieron obtener los ids de ambos usuarios. Verifica que existan en Auth.')
    process.exit(1)
  }

  // 5. User 1: actualizar a admin en org default (el trigger lo insertó como 'user')
  const { data: update1Data, error: update1 } = await supabase
    .from('organization_members')
    .update({ role: 'admin' })
    .eq('organization_id', defaultOrg.id)
    .eq('user_id', createdUserIds[0])
    .select('id')

  if (update1) {
    console.warn('⚠️  No se pudo actualizar rol de user1:', update1.message)
  } else if (!update1Data?.length) {
    console.warn('⚠️  User1 no está en org default (¿trigger falló?). Intentando insertar...')
    const { error: ins1 } = await supabase.from('organization_members').insert({
      organization_id: defaultOrg.id,
      user_id: createdUserIds[0],
      role: 'admin',
    })
    if (ins1) console.warn('   Insert falló:', ins1.message)
    else console.log(`✅ ${USERS[0].email} → admin de "Mi Organización" (default)`)
  } else {
    console.log(`✅ ${USERS[0].email} → admin de "Mi Organización" (default)`)
  }

  // 6. User 2: agregar como admin de org 2 (upsert por si ya existe)
  const { error: insert2 } = await supabase.from('organization_members').upsert(
    { organization_id: org2Id, user_id: createdUserIds[1], role: 'admin' },
    { onConflict: 'organization_id,user_id' }
  )

  if (insert2) {
    console.warn('⚠️  Error agregando user2 a org 2:', insert2.message)
  } else {
    console.log(`✅ ${USERS[1].email} → admin de "${USERS[1].orgName}"`)
  }

  // 7. Verificar roles en BD
  const { data: members } = await supabase
    .from('organization_members')
    .select('organization_id, user_id, role')
    .in('user_id', createdUserIds)
    .eq('role', 'admin')

  const adminCount = members?.length || 0
  console.log('\n📋 Verificación de roles en BD:')
  if (adminCount >= 2) {
    console.log(`   ✓ lucasciceri59@gmail.com → Mi Organización (admin)`)
    console.log(`   ✓ ciceridev@gmail.com → ${USERS[1].orgName} (admin)`)
  } else {
    console.log(`   ⚠️  Se encontraron ${adminCount} admins (esperado: 2). Revisa organization_members.`)
  }

  console.log('\n📋 Resumen:')
  console.log('   Org 1 (default): Mi Organización - lucasciceri59@gmail.com (admin)')
  console.log(`   Org 2: ${USERS[1].orgName} - ciceridev@gmail.com (admin)`)
  console.log(`\n   Contraseña temporal para ambos: ${DEFAULT_PASSWORD}`)
  console.log('   ⚠️  Cambia la contraseña al iniciar sesión.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
