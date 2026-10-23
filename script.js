document.getElementById("year").textContent = new Date().getFullYear();
document.querySelectorAll(".order-link").forEach((link) => {
  const product = link.dataset.product || "طلب من كنافة البشوات";
  const message = `السلام عليكم، أريد طلب: ${product}.`;
  link.href = `https://wa.me/966536839290?text=${encodeURIComponent(message)}`;
  link.target = "_blank";
  link.rel = "noopener";
});
