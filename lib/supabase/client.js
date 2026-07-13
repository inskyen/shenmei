import { createClient } from '@supabase/supabase-js';

// 所有瀏覽器端 Supabase 操作都從這裡取得 client。
// 這樣登入頁、採樣頁、信息流頁不用各自重複初始化，也避免把 URL / key 硬編碼在頁面裡。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 這兩個環境變數是公開 anon key 設定，可以出現在前端 bundle。
// 但它們仍然必須放在 .env.local 裡管理，不能直接寫死在程式碼中。
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '缺少 Supabase 環境變數：請確認 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY 已設定。'
  );
}

// 單例 client：同一個頁面生命週期內共用連線設定，避免重複建立。
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
