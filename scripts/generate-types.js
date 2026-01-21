#!/usr/bin/env node

/**
 * Script para generar los tipos de TypeScript desde Supabase
 * usando las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
 */

/* eslint-env node */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

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
          // Remover comillas si existen
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

// Extraer project ID de la URL de Supabase
function extractProjectId(supabaseUrl) {
  try {
    // Formato estándar: https://xxxxx.supabase.co o https://xxxxx.supabase.co/
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
    if (match && match[1]) {
      return match[1]
    }
    // Si es una URL personalizada, retornar null
    return null
  } catch (error) {
    return null
  }
}

// Verificar si supabase CLI está instalado
function hasSupabaseCLI() {
  try {
    execSync('supabase --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Generar tipos usando Supabase CLI
function generateTypesWithCLI(projectId, accessToken) {
  try {
    console.log(`Generando tipos para el proyecto: ${projectId}...`)
    
    // Si hay access token, usarlo
    let command = `supabase gen types typescript --project-id ${projectId}`
    if (accessToken) {
      command += ` --access-token ${accessToken}`
    }
    
    const output = execSync(
      command,
      { encoding: 'utf-8', cwd: rootDir, stdio: 'pipe' }
    )
    return output
  } catch (error) {
    // Si falla, intentar sin access token (puede requerir login)
    if (!accessToken) {
      throw new Error(
        `Error generando tipos. El CLI de Supabase requiere autenticación.\n` +
        `Ejecuta: supabase login\n` +
        `O proporciona un access token en la variable SUPABASE_ACCESS_TOKEN`
      )
    }
    throw new Error(`Error generando tipos con CLI: ${error.message}`)
  }
}

// Función principal
async function main() {
  console.log('🚀 Generando tipos de TypeScript desde Supabase...\n')
  
  // Cargar variables de entorno
  const envVars = loadEnvVars()
  const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const accessToken = envVars.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_ACCESS_TOKEN
  const projectIdEnv = envVars.SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID
  
  if (!supabaseUrl || !anonKey) {
    console.error('❌ Error: Variables de entorno no encontradas')
    console.error('   Asegúrate de tener VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env')
    process.exit(1)
  }
  
  try {
    // Intentar extraer project ID de la URL
    let projectId = extractProjectId(supabaseUrl)
    
    // Si no se pudo extraer (URL personalizada), usar variable de entorno
    if (!projectId) {
      if (projectIdEnv) {
        projectId = projectIdEnv
        console.log('⚠ URL personalizada detectada, usando SUPABASE_PROJECT_ID de .env\n')
      } else {
        console.error('❌ Error: No se pudo determinar el Project ID')
        console.error('\n   Tu URL de Supabase es personalizada (no es *.supabase.co)')
        console.error('   Necesitas proporcionar el Project ID manualmente.\n')
        console.error('   Opciones:')
        console.error('   1. Agregar a tu archivo .env:')
        console.error('      SUPABASE_PROJECT_ID=tu_project_id\n')
        console.error('   2. Obtener el Project ID desde:')
        console.error('      - Tu dashboard de Dokploy/VPS')
        console.error('      - O desde el dashboard de Supabase si tienes acceso\n')
        console.error('   3. Alternativa: Generar tipos manualmente desde Supabase Dashboard:')
        console.error('      Settings > API > Generate TypeScript types\n')
        process.exit(1)
      }
    }
    
    console.log(`✓ Project ID: ${projectId}\n`)
    
    let typesContent
    
    // Intentar usar CLI primero
    if (hasSupabaseCLI()) {
      console.log('✓ Supabase CLI detectado\n')
      typesContent = generateTypesWithCLI(projectId, accessToken)
    } else {
      console.log('⚠ Supabase CLI no encontrado\n')
      console.log('Intentando usar npx supabase...\n')
      
      // Intentar usar npx para ejecutar supabase sin instalación global
      try {
        let command = `npx --yes supabase gen types typescript --project-id ${projectId}`
        if (accessToken) {
          command += ` --access-token ${accessToken}`
        }
        
        typesContent = execSync(
          command,
          { encoding: 'utf-8', cwd: rootDir, stdio: 'pipe' }
        )
      } catch (npxError) {
        console.error('\n❌ No se pudo generar los tipos automáticamente.\n')
        console.log('📋 Opciones disponibles:\n')
        console.log('1. Instalar Supabase CLI globalmente:')
        console.log('   npm install -g supabase')
        console.log('   supabase login')
        console.log('   yarn generate-types\n')
        console.log('2. Usar npx con autenticación:')
        console.log('   npx supabase gen types typescript --project-id ' + projectId)
        console.log('   (te pedirá autenticación)\n')
        console.log('3. Desde el Dashboard de Supabase:')
        console.log('   Settings > API > Generate TypeScript types\n')
        console.log('4. Agregar SUPABASE_ACCESS_TOKEN a tu .env:')
        console.log('   (obtén el token desde: https://supabase.com/dashboard/account/tokens)')
        throw npxError
      }
    }
    
    // Guardar tipos en el archivo
    const outputPath = join(rootDir, 'src/types/database.types.ts')
    writeFileSync(outputPath, typesContent, 'utf-8')
    
    console.log(`\n✅ Tipos generados exitosamente en: ${outputPath}`)
    console.log(`   Total de líneas: ${typesContent.split('\n').length}`)
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (error.stdout) {
      console.error('Salida:', error.stdout)
    }
    if (error.stderr) {
      console.error('Errores:', error.stderr)
    }
    process.exit(1)
  }
}

main()
