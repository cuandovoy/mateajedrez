#!/usr/bin/env node

/**
 * Script alternativo para generar tipos de TypeScript desde Supabase
 * usando la API REST directamente cuando no tenemos el Project ID
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

// Leer variables de entorno del archivo .env
function loadEnvVars() {
  try {
    const envPath = join(rootDir, '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const envVars = {}
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          envVars[key.trim()] = value.replace(/^["']|["']$/g, '')
        }
      }
    })
    
    return envVars
  } catch (error) {
    console.error('Error leyendo archivo .env:', error.message)
    return {}
  }
}

// Generar tipos usando el método de Supabase CLI con db URL
async function generateTypesFromDB() {
  const envVars = loadEnvVars()
  const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !anonKey) {
    throw new Error('Variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY son requeridas')
  }

  console.log('⚠️  Método alternativo: Generando tipos desde la base de datos...\n')
  console.log('📝 Nota: Este método requiere que tengas acceso a la base de datos.\n')
  console.log('💡 Alternativa recomendada:')
  console.log('   1. Obtén el Project ID desde tu dashboard de Dokploy/Supabase')
  console.log('   2. Agrega a tu .env: SUPABASE_PROJECT_ID=tu_project_id')
  console.log('   3. Ejecuta: yarn generate-types\n')
  
  // Intentar usar el CLI con la URL de la base de datos directamente
  // Esto requiere que la URL tenga el formato correcto para la conexión a la DB
  const dbUrl = supabaseUrl.replace('/rest/v1', '').replace('api.', 'db.')
  
  console.log('🔗 Intentando conectar a:', dbUrl)
  console.log('❌ Este método no está completamente implementado.\n')
  console.log('📋 Por favor, usa uno de estos métodos:\n')
  console.log('1. Obtén el Project ID y agrégalo a .env como SUPABASE_PROJECT_ID')
  console.log('2. Genera tipos manualmente desde Supabase Dashboard:')
  console.log('   Settings > API > Generate TypeScript types')
  console.log('   Luego copia el contenido a src/types/database.types.ts\n')
  
  throw new Error('Project ID requerido para generar tipos automáticamente')
}

async function main() {
  try {
    await generateTypesFromDB()
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
