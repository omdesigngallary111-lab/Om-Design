/**
 * Single source of studio details so Contact, Footer, FABs, and maps links
 * stay in sync.
 *
 * Owner photos: add a file under `public/owners/` then set `photo`,
 * e.g. photo: '/owners/nilesh-sutariya.jpg'
 */
export const STUDIO = {
  name: "Om Design & Classes",
  phoneDisplay: "+91 88664 01539",
  phoneTel: "+918866401539",
  /** Digits only, country code included — used by wa.me */
  whatsappNumber: "918866401539",
  whatsappMessage:
    "Namaste! I would like to know more about Om Design & Classes embroidery designs.",
  email: "omdesigngallary111@gmail.com",
  addressLines: [
    "1st Floor Bhagvati Ras",
    "Ghanshyam Nagar, L.H. Road",
    "Varachha, Surat",
  ],
  // Official Google Business listing — do not rebuild from address text.
  mapsUrl: "https://maps.app.goo.gl/5XSKJS2sE3DvgV8t6",
  mapsEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1859.76603687577!2d72.85919791744388!3d21.210739600000025!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be04ff5cacbf2af%3A0x16f9a5f759658c95!2sOm%20Design%20%26%20Classes%20(Embroidery%20Design%20%26%20Embroidery%20classes)!5e0!3m2!1sen!2sin!4v1787234192840!5m2!1sen!2sin",
};

/** WhatsApp chat link, optionally with a prefilled message. */
export function getWhatsAppUrl(message = STUDIO.whatsappMessage) {
  const base = `https://wa.me/${STUDIO.whatsappNumber}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

export const OWNERS = [
  {
    name: "Nilesh Sutariya",
    slug: "nilesh-sutariya",
    photo: "/owners/nilesh-sutariya.png",
  },
  {
    name: "Bhavesh Mangukiya",
    slug: "bhavesh-mangukiya",
    photo: "/owners/bhavesh-mangukiya.png",
  },
  {
    name: "Bhavdip Sutariya",
    slug: "bhavdip-sutariya",
    photo: "/owners/bhavdip-sutariya.png",
  },
  {
    name: "Ajay Sutariya",
    slug: "ajay-sutariya",
    photo: "/owners/ajay-sutariya.png",
  },
];

export const LOGO_SRC = "/logo.png";
