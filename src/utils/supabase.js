import { createClient } from '@supabase/supabase-js';  

// ¡IMPORTANTE! Reemplaza estos valores con los tuyos de Supabase:  
// - Ve a tu dashboard de Supabase > Settings > API  
// - Copia la URL del proyecto (algo como https://abc123.supabase.co)  
// - Copia la clave "anon" (la pública) y pégala aquí abajo  
const supabaseUrl = 'https://tu-proyecto.supabase.co'; // ← CAMBIA ESTO  
const supabaseKey = 'tu-clave-anon-aqui'; // ← Y ESTO  

// Si no cambias estos, la conexión fallará y verás errores. Prueba después de actualizar.  
export const supabase = createClient(supabaseUrl, supabaseKey);