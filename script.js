/*
  كنافة البشوات — تحميل المنتجات من Supabase.
  ضع Publishable key العام فقط هنا. لا تضع Secret key أو service_role key في المتصفح.
*/
const SUPABASE_URL = "https://tyzhnavetxvdfkrbnolz.supabase.co";
const SUPABASE_KEY = "sb_publishable_wSW7V7f7KhPy2Nmav4PTnQ_WG8YeGT2";
const WHATSAPP_NUMBER = "966536839290"; // رقم دولي دون + أو مسافات

const yearElement = document.getElementById("year");
if (yearElement) yearElement.textContent = String(new Date().getFullYear());

function setWhatsAppLinks() {
  const url = `https://wa.me/${WHATSAPP_NUMBER}`;
  ["header-order", "cta-order", "floating-whatsapp"].forEach((id) => {
    const link = document.getElementById(id);
    if (link) {
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}
setWhatsAppLinks();

const productRoot = document.getElementById("product-sections");

function showMessage(title, detail, retry = false) {
  if (!productRoot) return;
  productRoot.replaceChildren();
  const box = document.createElement("div");
  box.className = "message-state";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const message = document.createElement("p");
  message.textContent = detail;
  box.append(heading, message);
  if (retry) {
    const button = document.createElement("button");
    button.className = "retry-button";
    button.type = "button";
    button.textContent = "إعادة المحاولة";
    button.addEventListener("click", loadProducts);
    box.append(button);
  }
  productRoot.append(box);
}

function makeProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";

  const img = document.createElement("img");
  const imageUrl = typeof product.image_url === "string" ? product.image_url.trim() : "";
  if (imageUrl) {
    img.src = imageUrl;
  } else {
    img.classList.add("image-missing");
  }
  img.alt = product.name ? `صورة ${product.name}` : "صورة منتج";
  img.loading = "lazy";
  img.onerror = () => img.classList.add("image-missing");

  const info = document.createElement("div");
  info.className = "product-info";

  const name = document.createElement("h3");
  name.textContent = product.name || "منتج جديد";

  const description = document.createElement("p");
  description.textContent = product.description || "للتفاصيل، تواصل معنا عبر واتساب.";

  const row = document.createElement("div");
  row.className = "price-row";

  const price = document.createElement("span");
  price.className = "price";
  const hasPrice = product.price !== null && product.price !== undefined && product.price !== "";
  const numericPrice = Number(product.price);
  price.textContent = hasPrice && Number.isFinite(numericPrice)
    ? `${new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(numericPrice)} ر.س`
    : "السعر عند الطلب";

  const order = document.createElement("a");
  order.className = "order-link";
  order.textContent = "اطلبها";
  const message = `السلام عليكم، أريد طلب: ${product.name || "منتج من كنافة البشوات"}. السعر: ${hasPrice ? product.price + " ر.س" : "يرجى التوضيح"}.`;
  order.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  order.target = "_blank";
  order.rel = "noopener noreferrer";

  row.append(price, order);
  info.append(name, description, row);
  if (imageUrl) card.append(img, info);
  else card.append(info);
  return card;
}

function makeCategorySection(category, items) {
  const section = document.createElement("section");
  section.className = "products section-wrap";

  const heading = document.createElement("div");
  heading.className = "section-heading";

  const headingContent = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "تشكيلة كنافة البشوات";

  const title = document.createElement("h2");
  title.textContent = category;
  headingContent.append(eyebrow, title);

  const line = document.createElement("span");
  line.className = "heading-line";
  line.setAttribute("aria-hidden", "true");
  heading.append(headingContent, line);

  const grid = document.createElement("div");
  grid.className = "product-grid";
  items.forEach((product) => grid.append(makeProductCard(product)));

  section.append(heading, grid);
  return section;
}

async function loadProducts() {
  if (!productRoot) return;

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    showMessage("تعذر تحميل مكتبة الاتصال", "تحقق من اتصال الإنترنت ومن وجود مكتبة Supabase في index.html.", true);
    return;
  }
  if (!SUPABASE_KEY || SUPABASE_KEY === "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE") {
    showMessage("باقي إعداد واحد", "افتح script.js وضع Publishable key العام من إعدادات مشروع Supabase بدل النص التجريبي.", false);
    return;
  }

  productRoot.replaceChildren();
  const loading = document.createElement("div");
  loading.className = "loading-state";
  const loader = document.createElement("span");
  loader.className = "loader";
  const loadingText = document.createElement("p");
  loadingText.textContent = "جارٍ تحميل المنتجات...";
  loading.append(loader, loadingText);
  productRoot.append(loading);

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await client
      .from("products")
      .select("id, name, description, price, image_url, category")
      .order("id", { ascending: true });

    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) {
      showMessage("القائمة جاهزة لاستقبال المنتجات", "لم نعثر على منتجات في جدول products. أضف المنتجات إلى Supabase ثم أعد تحميل الصفحة.", false);
      return;
    }

    const grouped = new Map();
    data.forEach((product) => {
      const category = (product.category || "").trim() || "أصناف إضافية";
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(product);
    });

    productRoot.replaceChildren();
    grouped.forEach((items, category) => {
      productRoot.append(makeCategorySection(category, items));
    });
  } catch (error) {
    console.error("Supabase products error:", error);
    const detail = error && error.message
      ? `التفاصيل: ${error.message}. تحقق من اسم الجدول والأعمدة ومفتاح المشروع وسياسة القراءة (RLS).`
      : "تحقق من إعدادات Supabase والاتصال بالإنترنت وسياسة قراءة المنتجات.";
    showMessage("لم نتمكن من تحميل المنتجات", detail, true);
  }
}

loadProducts();
