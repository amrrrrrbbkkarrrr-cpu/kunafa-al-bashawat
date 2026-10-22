/* لوحة إدارة المنتجات. استخدم Publishable key فقط؛ لا تضع service_role في المتصفح. */
const SUPABASE_URL = "https://tyzhnavetxvdfkrbnolz.supabase.co";
const SUPABASE_KEY = "sb_publishable_wSW7V7f7KhPy2Nmav4PTnQ_WG8YeGT2";
const IMAGE_BUCKET = "product-images";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
let currentUser = null;
let productsCache = [];

function notice(message, type = "") { const el = $("notice"); el.textContent = message; el.className = `notice ${type}`; el.hidden = false; }
function hideNotice() { $("notice").hidden = true; }
function setLoggedIn(isLoggedIn) { $("login-panel").hidden = isLoggedIn; $("dashboard").hidden = !isLoggedIn; }
function adminError(error) {
  const msg = error?.message || String(error || "خطأ غير معروف");
  if (/row-level security|permission denied|not allowed/i.test(msg)) return `${msg} — راجع سياسات RLS وأضف حسابك إلى جدول admin_users وفق README_AR.md.`;
  return msg;
}
async function verifyAdmin(user) {
  const { data, error } = await client.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("تم تسجيل الدخول لكن هذا الحساب ليس ضمن المديرين. أضف User UID إلى جدول admin_users من SQL Editor حسب README_AR.md.");
}
async function restoreSession() {
  const { data, error } = await client.auth.getSession();
  if (error) { notice(adminError(error), "error"); return; }
  if (!data.session) { setLoggedIn(false); return; }
  try { await verifyAdmin(data.session.user); currentUser = data.session.user; setLoggedIn(true); await loadProducts(); }
  catch (e) { await client.auth.signOut(); setLoggedIn(false); notice(adminError(e), "error"); }
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); hideNotice();
  const button = event.submitter; button.disabled = true; button.textContent = "جارٍ تسجيل الدخول...";
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) throw error;
    await verifyAdmin(data.user); currentUser = data.user; setLoggedIn(true); notice("تم تسجيل الدخول بنجاح.", "success"); await loadProducts();
  } catch (e) { await client.auth.signOut(); setLoggedIn(false); notice(adminError(e), "error"); }
  finally { button.disabled = false; button.textContent = "تسجيل الدخول"; }
});

async function loadProducts() {
  const root = $("admin-products"); root.replaceChildren(); const loading = document.createElement("p"); loading.textContent = "جارٍ تحميل المنتجات..."; root.append(loading);
  const { data, error } = await client.from("products").select("id,name,description,price,image_url,category").order("id", { ascending: false });
  if (error) { root.replaceChildren(); const p = document.createElement("p"); p.className = "empty-admin"; p.textContent = adminError(error); root.append(p); return; }
  productsCache = data || []; root.replaceChildren();
  if (!productsCache.length) { const p = document.createElement("p"); p.className = "empty-admin"; p.textContent = "لا توجد منتجات حتى الآن. استخدم النموذج أعلاه لإضافة أول منتج."; root.append(p); return; }
  productsCache.forEach(product => {
    const row = document.createElement("article"); row.className = "admin-product";
    const img = document.createElement("img"); img.alt = "صورة المنتج"; img.src = product.image_url || ""; img.hidden = !product.image_url; img.onerror = () => { img.hidden = true; };
    const info = document.createElement("div"); const title = document.createElement("h3"); title.textContent = product.name;
    const detail = document.createElement("p"); detail.textContent = `${product.category || "بلا تصنيف"} • ${product.price ?? "بدون سعر"} ر.س`;
    const desc = document.createElement("p"); desc.textContent = product.description || "لا يوجد وصف"; info.append(title, detail, desc);
    const actions = document.createElement("div"); actions.className = "admin-product-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "edit-button"; edit.textContent = "تعديل"; edit.addEventListener("click", () => startEdit(product));
    const del = document.createElement("button"); del.type = "button"; del.className = "delete-button"; del.textContent = "حذف"; del.addEventListener("click", () => deleteProduct(product));
    actions.append(edit, del); row.append(img, info, actions); root.append(row);
  });
}
function startEdit(p) {
  $("product-id").value = p.id; $("name").value = p.name || ""; $("category").value = p.category || ""; $("price").value = p.price ?? ""; $("description").value = p.description || ""; $("image-url").value = p.image_url || "";
  $("image-file").value = ""; $("image-preview").hidden = !p.image_url; if (p.image_url) $("image-preview").src = p.image_url;
  $("form-title").textContent = "تعديل المنتج"; $("save-product").textContent = "حفظ التعديلات"; $("cancel-edit").hidden = false; window.scrollTo({ top: 0, behavior: "smooth" });
}
function resetForm() { $("product-form").reset(); $("product-id").value = ""; $("image-preview").hidden = true; $("image-preview").removeAttribute("src"); $("form-title").textContent = "إضافة منتج جديد"; $("save-product").textContent = "إضافة المنتج"; $("cancel-edit").hidden = true; }
$("cancel-edit").addEventListener("click", resetForm);
$("image-file").addEventListener("change", () => { const file = $("image-file").files[0]; if (!file) { $("image-preview").hidden = true; return; } if (file.size > 5 * 1024 * 1024) { notice("حجم الصورة أكبر من 5 ميجابايت.", "error"); $("image-file").value = ""; return; } $("image-preview").src = URL.createObjectURL(file); $("image-preview").hidden = false; });
async function uploadImage(file) {
  if (!file) return null;
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error("نوع الصورة غير مدعوم. استخدم PNG أو JPG أو WEBP أو GIF.");
  if (file.size > 5 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
  const ext = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif" })[file.type];
  const path = `${currentUser.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = client.storage.from(IMAGE_BUCKET).getPublicUrl(path); return data.publicUrl;
}
$("product-form").addEventListener("submit", async (event) => {
  event.preventDefault(); hideNotice(); const button = $("save-product"); button.disabled = true; button.textContent = "جارٍ الحفظ...";
  try {
    let imageUrl = $("image-url").value.trim() || null;
    const file = $("image-file").files[0]; if (file) imageUrl = await uploadImage(file);
    const record = { name: $("name").value.trim(), category: $("category").value.trim(), description: $("description").value.trim() || null, price: Number($("price").value), image_url: imageUrl };
    const id = $("product-id").value;
    const result = id ? await client.from("products").update(record).eq("id", id).select().single() : await client.from("products").insert(record).select().single();
    if (result.error) throw result.error;
    resetForm(); notice(id ? "تم تحديث المنتج بنجاح." : "تمت إضافة المنتج بنجاح، وسيظهر في المتجر.", "success"); await loadProducts();
  } catch (e) { notice(adminError(e), "error"); }
  finally { button.disabled = false; button.textContent = $("product-id").value ? "حفظ التعديلات" : "إضافة المنتج"; }
});
async function deleteProduct(product) {
  if (!confirm(`هل أنت متأكد من حذف «${product.name}»؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
  const { error } = await client.from("products").delete().eq("id", product.id);
  if (error) { notice(adminError(error), "error"); return; }
  notice("تم حذف المنتج.", "success"); if ($("product-id").value === String(product.id)) resetForm(); await loadProducts();
}
$("refresh-products").addEventListener("click", loadProducts);
$("sign-out").addEventListener("click", async () => { await client.auth.signOut(); currentUser = null; setLoggedIn(false); notice("تم تسجيل الخروج.", "success"); });
restoreSession();
