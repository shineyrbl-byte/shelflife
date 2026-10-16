"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Category, Unit } from "./schema";

// Translations for the screens staff use every day and the customer deals page.
// To add a language: add it to LANGS and give it every key in `en` (TypeScript checks nothing is missing).
// Product names, bundle titles and server error messages stay as entered/sent.

export const LANGS = { en: "EN", hi: "हिं" } as const;
export type Lang = keyof typeof LANGS;

const en = {
  // Staff header
  "nav.dashboard": "Dashboard",
  "nav.stock": "Stock",
  "nav.bundles": "Bundles",
  "nav.insights": "Insights",
  "nav.poster": "Poster",
  "nav.settings": "Settings",
  "nav.customerDeals": "Customer deals ↗",
  "nav.logout": "Log out",

  // Common
  "common.loading": "Loading…",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.atCost": "{amount} at cost",
  "common.today": "today",
  "common.tomorrow": "tomorrow",
  "common.priceBelowCost": "Selling price is below cost. Double-check the prices.",

  // Categories and units
  "cat.bakery": "Bakery",
  "cat.dairy": "Dairy",
  "cat.produce": "Fruit & veg",
  "cat.beverages": "Drinks",
  "cat.prepared": "Prepared food",
  "cat.packaged": "Packaged",
  "unit.pcs": "pcs",
  "unit.kg": "kg",
  "unit.L": "L",
  "unit.pack": "pack",

  // Stock page
  "stock.title": "Stock",
  "stock.subtitle": "Soonest expiry first. Leave the quantity empty to log the whole batch.",
  "stock.empty": "No stock yet. Add your first delivery above.",
  "stock.group.expired": "Expired: log as wasted",
  "stock.group.today": "Expires today",
  "stock.group.soon": "Expires in 1–2 days",
  "stock.group.fresh": "Fresh",
  "stock.items": "{n} items",
  "stock.item": "1 item",
  "stock.expiredAgo": "expired {n}d ago",
  "stock.expires": "expires {when}",
  "stock.quantity": "Quantity",
  "stock.sold": "Sold",
  "stock.donated": "Donated",
  "stock.donatedHint": "Given to a food bank, NGO or people in need",
  "stock.wasted": "Wasted",
  "stock.edit": "Edit",
  "stock.delete": "Delete (entered by mistake)",
  "stock.hasHistory": "This batch has history, so log it as sold or wasted instead.",

  // Add stock form
  "add.title": "Add stock",
  "add.subtitle": "One line per delivery or bake, with its expiry date. Packaged goods: scan the barcode first.",
  "add.barcode": "Barcode (optional)",
  "add.barcodePlaceholder": "Scan or type, then Enter",
  "add.scanBarcode": "📷 Scan barcode",
  "add.item": "Item",
  "add.itemPlaceholder": "e.g. Croissant",
  "add.category": "Category",
  "add.quantity": "Quantity",
  "add.cost": "Cost / unit (₹)",
  "add.price": "Price / unit (₹)",
  "add.expiresOn": "Expires on",
  "add.today": "Today",
  "add.tomorrow": "Tomorrow",
  "add.plus3": "+3 days",
  "add.plusWeek": "+1 week",
  "add.submit": "Add to stock",
  "add.adding": "Adding…",
  "add.needNameQty": "Add a name and a quantity.",
  "add.lookingUp": "Looking up barcode…",
  "add.knownItem": "{name}: details filled in from last time. Enter the quantity and check the expiry date.",
  "add.foundOff": "Found \"{name}\" on Open Food Facts. Add the prices once and it'll be remembered.",
  "add.newBarcode": "New barcode. Fill in the details once and ShelfLife will remember them next time.",

  // Edit line
  "edit.item": "Item",
  "edit.category": "Category",
  "edit.qtyReceived": "Qty received",
  "edit.quantity": "Quantity",
  "edit.unitFixed": "Unit is fixed once sales or waste are logged",
  "edit.cost": "Cost ₹",
  "edit.price": "Price ₹",
  "edit.expires": "Expires",

  // Barcode scanner
  "scanner.hint": "Point the camera at the barcode. It scans automatically.",
  "scanner.denied": "Camera permission was denied. Allow camera access for this site in your browser settings, or type the barcode instead.",
  "scanner.failed": "Couldn't open the camera. You can type the barcode instead.",

  // Bill scan
  "bill.title": "📷 Scan a supplier bill",
  "bill.subtitle": "Take a photo of the bill and AI fills in the items. You check everything before it's added.",
  "bill.scan": "Scan a bill",
  "bill.reading": "Reading the bill…",
  "bill.another": "Scan another",
  "bill.found": "Found {n} items",
  "bill.from": " from {supplier}",
  "bill.checkBoth": "Expiry dates are AI estimates and prices start at about twice cost: check both.",
  "bill.col.item": "Item",
  "bill.col.category": "Category",
  "bill.col.qty": "Qty",
  "bill.col.cost": "Cost/unit",
  "bill.col.price": "Price/unit",
  "bill.col.expires": "Expires",
  "bill.selected": "{n} selected",
  "bill.discard": "Discard",
  "bill.add": "Add {n} to stock",
  "bill.unnamed": "unnamed item",
  "bill.checkLine": "Check \"{name}\": it needs a name, a quantity, and a price at or above cost.",

  // Bundles page
  "bundles.title": "Rescue bundles",
  "bundles.subtitle": "Turn stock that expires in the next 2 days into discounted bundles, instead of throwing it away.",
  "bundles.reservations": "Reservations to pick up",
  "bundles.reservationsHint": "Ask for the name and the 4-digit code, then take payment and tap Picked up.",
  "bundles.pickUpBy": "pick up by {time}",
  "bundles.holdEnded": "hold ended at {time}",
  "bundles.pickedUp": "Picked up",
  "bundles.upiClaimed": "Says paid by UPI",
  "bundles.upiCheck": "Check your UPI app for {price} with the note \"{note}\" before handing it over.",
  "bundles.clear": "Clear",
  "bundles.onSale": "On sale now",
  "bundles.nothingOnSale": "Nothing on sale yet. Publish a suggestion below.",
  "bundles.until": "until {when}",
  "bundles.stats": "{sold} sold · {left} left",
  "bundles.reserved": " · {n} reserved",
  "bundles.sold1": "Sold 1",
  "bundles.takeDown": "Take down",
  "bundles.suggested": "Suggested bundles",
  "bundles.suggestedHint": "Paired by what people buy together, discounted by how soon they expire, and never priced below cost. You can edit the price.",
  "bundles.finding": "Finding bundles…",
  "bundles.nothingToRescue": "Nothing needs rescuing right now. Items expiring within 2 days will show up here.",
  "bundles.checkStock": "Check stock",
  "bundles.expires": "Expires {when}",
  "bundles.nameLabel": "Bundle name",
  "bundles.descLabel": "Description for customers",
  "bundles.writeAi": "✨ Write with AI",
  "bundles.writing": "Writing…",
  "bundles.priceLabel": "Bundle price",
  "bundles.off": "{n}% off",
  "bundles.enoughFor": "enough for {n}",
  "bundles.publish": "Publish to customer deals",
  "bundles.publishing": "Publishing…",

  // Customer deals page
  "deals.kicker": "Rescue deals",
  "deals.kickerAt": "Rescue deals at {shop}",
  "deals.title": "Good food, less waste",
  "deals.intro": "These are fresh items close to their best-before date, bundled at a discount so nothing goes in the bin. Reserve one and pick it up within the hour, or just show this page at the counter.",
  "deals.missing": "This shop link doesn't exist. Check the QR code or ask the shop.",
  "deals.loading": "Loading today's deals…",
  "deals.none": "No deals right now. Check back later today!",
  "deals.rescuedSoFar": "🌱 Thanks to customers like you, {shop} has rescued about {kg} kg of food so far.",
  "deals.off": "{n}% off",
  "deals.until": "Until {when}",
  "deals.onlyLeft": "Only {n} left",
  "deals.left": "{n} left",
  "deals.reserve": "Reserve for pickup",
  "deals.yourName": "Your first name (so the shop knows it's you)",
  "deals.holdNote": "We'll hold it for 1 hour. Pay at the counter when you pick it up.",
  "deals.reserveFor": "Reserve for {price}",
  "deals.reserving": "Reserving…",
  "deals.reserveFailed": "Couldn't reserve. Please try again.",
  "deals.reserved": "Reserved for you ✓",
  "deals.pickupCode": "Pickup code",
  "deals.pickUpBy": "Pick up by {time}",
  "deals.payAtCounter": "Pay {price} at the counter",
  "deals.cantMakeIt": "I can't make it, cancel",
  "deals.payUpi": "Pay {price} now with UPI",
  "deals.payUpiHint": "Opens GPay, PhonePe, Paytm or any UPI app. You can also pay at the counter.",
  "deals.showQr": "On a computer? Show a QR code to scan",
  "deals.hideQr": "Hide QR code",
  "deals.paidButton": "I've paid",
  "deals.paidDone": "Payment sent ✓ Show your code at the counter.",
  "deals.paidCantCancel": "Already paid? Ask the shop to cancel and refund it.",
  "deals.share": "Share on WhatsApp",
  "deals.alerts": "🔔 Get deal alerts",
  "deals.alertsTitle": "🔔 Get a notification when {shop} posts a new deal",
  "deals.alertsFree": "Free, no account needed, and you can turn it off any time.",
  "deals.alertsBrowser": "On this phone or computer:",
  "deals.alertsOpen": "open the alerts page",
  "deals.alertsBrowserRest": "and tap Subscribe, then allow notifications.",
  "deals.alertsApp": "Or with the ntfy app (App Store / Play Store): tap + and subscribe to",
  "deals.copied": "copied ✓",
  "deals.thisShop": "this shop",
  "deals.copy": "Copy",
  "deals.shareLine": "• {title}: {price} (was {was}), until {when}",
  "deals.shareText": "Today's rescue deals at {shop} 🥐☕\n\n{lines}\n\nFresh food, lower prices, less waste. Limited stock:\n{url}",

  // Join page
  "join.checking": "Checking your invite…",
  "join.title": "Join {shop}",
  "join.subtitle": "Set up your own login to add stock and sell rescue bundles.",
  "join.name": "Your name",
  "join.email": "Email",
  "join.password": "Password",
  "join.passwordHint": "At least 8 characters",
  "join.wait": "Please wait…",
  "join.submit": "Join {shop}",
} as const;

export type Key = keyof typeof en;

const hi: Record<Key, string> = {
  "nav.dashboard": "डैशबोर्ड",
  "nav.stock": "स्टॉक",
  "nav.bundles": "बंडल",
  "nav.insights": "रिपोर्ट",
  "nav.poster": "पोस्टर",
  "nav.settings": "सेटिंग्स",
  "nav.customerDeals": "ग्राहक ऑफ़र ↗",
  "nav.logout": "लॉग आउट",

  "common.loading": "लोड हो रहा है…",
  "common.save": "सेव करें",
  "common.cancel": "रद्द करें",
  "common.atCost": "लागत {amount}",
  "common.today": "आज",
  "common.tomorrow": "कल",
  "common.priceBelowCost": "बिक्री दाम लागत से कम है। दाम दोबारा जाँच लें।",

  "cat.bakery": "बेकरी",
  "cat.dairy": "डेयरी",
  "cat.produce": "फल-सब्ज़ी",
  "cat.beverages": "पेय",
  "cat.prepared": "तैयार खाना",
  "cat.packaged": "पैक्ड सामान",
  "unit.pcs": "पीस",
  "unit.kg": "किलो",
  "unit.L": "लीटर",
  "unit.pack": "पैक",

  "stock.title": "स्टॉक",
  "stock.subtitle": "जो पहले एक्सपायर होगा, वह सबसे ऊपर। पूरा बैच दर्ज करने के लिए मात्रा खाली छोड़ दें।",
  "stock.empty": "अभी कोई स्टॉक नहीं है। ऊपर अपनी पहली डिलीवरी जोड़ें।",
  "stock.group.expired": "एक्सपायर हो चुका: बर्बाद में दर्ज करें",
  "stock.group.today": "आज एक्सपायर होगा",
  "stock.group.soon": "1–2 दिन में एक्सपायर होगा",
  "stock.group.fresh": "ताज़ा",
  "stock.items": "{n} आइटम",
  "stock.item": "1 आइटम",
  "stock.expiredAgo": "{n} दिन पहले एक्सपायर",
  "stock.expires": "एक्सपायरी: {when}",
  "stock.quantity": "मात्रा",
  "stock.sold": "बिका",
  "stock.donated": "दान किया",
  "stock.donatedHint": "फ़ूड बैंक, NGO या ज़रूरतमंद लोगों को दिया",
  "stock.wasted": "बर्बाद",
  "stock.edit": "बदलें",
  "stock.delete": "हटाएँ (गलती से जोड़ा गया)",
  "stock.hasHistory": "इस बैच का हिसाब पहले से दर्ज है, इसलिए इसे बिका या बर्बाद में दर्ज करें।",

  "add.title": "स्टॉक जोड़ें",
  "add.subtitle": "हर डिलीवरी या बेक के लिए एक लाइन, उसकी एक्सपायरी तारीख के साथ। पैक्ड सामान: पहले बारकोड स्कैन करें।",
  "add.barcode": "बारकोड (ज़रूरी नहीं)",
  "add.barcodePlaceholder": "स्कैन करें या लिखें, फिर Enter",
  "add.scanBarcode": "📷 बारकोड स्कैन करें",
  "add.item": "आइटम",
  "add.itemPlaceholder": "जैसे क्रोसां",
  "add.category": "श्रेणी",
  "add.quantity": "मात्रा",
  "add.cost": "लागत / यूनिट (₹)",
  "add.price": "दाम / यूनिट (₹)",
  "add.expiresOn": "एक्सपायरी तारीख",
  "add.today": "आज",
  "add.tomorrow": "कल",
  "add.plus3": "+3 दिन",
  "add.plusWeek": "+1 हफ़्ता",
  "add.submit": "स्टॉक में जोड़ें",
  "add.adding": "जोड़ रहे हैं…",
  "add.needNameQty": "नाम और मात्रा भरें।",
  "add.lookingUp": "बारकोड खोज रहे हैं…",
  "add.knownItem": "{name}: पिछली बार की जानकारी भर दी गई है। मात्रा लिखें और एक्सपायरी तारीख जाँच लें।",
  "add.foundOff": "Open Food Facts पर \"{name}\" मिला। एक बार दाम भर दें, अगली बार याद रहेगा।",
  "add.newBarcode": "नया बारकोड। एक बार जानकारी भर दें, ShelfLife अगली बार याद रखेगा।",

  "edit.item": "आइटम",
  "edit.category": "श्रेणी",
  "edit.qtyReceived": "आई मात्रा",
  "edit.quantity": "मात्रा",
  "edit.unitFixed": "बिक्री या बर्बादी दर्ज होने के बाद यूनिट नहीं बदल सकते",
  "edit.cost": "लागत ₹",
  "edit.price": "दाम ₹",
  "edit.expires": "एक्सपायरी",

  "scanner.hint": "कैमरा बारकोड की तरफ़ करें। अपने आप स्कैन हो जाएगा।",
  "scanner.denied": "कैमरे की अनुमति नहीं मिली। ब्राउज़र सेटिंग्स में इस साइट को कैमरा की अनुमति दें, या बारकोड लिख दें।",
  "scanner.failed": "कैमरा नहीं खुल सका। आप बारकोड लिख सकते हैं।",

  "bill.title": "📷 सप्लायर का बिल स्कैन करें",
  "bill.subtitle": "बिल की फ़ोटो लें, AI आइटम भर देगा। जोड़ने से पहले आप सब कुछ जाँच लेते हैं।",
  "bill.scan": "बिल स्कैन करें",
  "bill.reading": "बिल पढ़ रहे हैं…",
  "bill.another": "दूसरा स्कैन करें",
  "bill.found": "{n} आइटम मिले",
  "bill.from": " ({supplier} से)",
  "bill.checkBoth": "एक्सपायरी तारीख AI का अंदाज़ा है और दाम लागत का लगभग दोगुना रखा गया है: दोनों जाँच लें।",
  "bill.col.item": "आइटम",
  "bill.col.category": "श्रेणी",
  "bill.col.qty": "मात्रा",
  "bill.col.cost": "लागत/यूनिट",
  "bill.col.price": "दाम/यूनिट",
  "bill.col.expires": "एक्सपायरी",
  "bill.selected": "{n} चुने गए",
  "bill.discard": "हटाएँ",
  "bill.add": "{n} स्टॉक में जोड़ें",
  "bill.unnamed": "बिना नाम का आइटम",
  "bill.checkLine": "\"{name}\" जाँचें: नाम, मात्रा, और लागत के बराबर या ज़्यादा दाम चाहिए।",

  "bundles.title": "रेस्क्यू बंडल",
  "bundles.subtitle": "अगले 2 दिन में एक्सपायर होने वाले स्टॉक को फेंकने की जगह छूट वाले बंडल में बेचें।",
  "bundles.reservations": "पिकअप के लिए रिज़र्वेशन",
  "bundles.reservationsHint": "नाम और 4 अंकों का कोड पूछें, फिर पैसे लेकर \"ले गए\" दबाएँ।",
  "bundles.pickUpBy": "{time} तक ले जाना है",
  "bundles.holdEnded": "होल्ड {time} पर खत्म हुआ",
  "bundles.pickedUp": "ले गए",
  "bundles.upiClaimed": "UPI से भुगतान बताया",
  "bundles.upiCheck": "देने से पहले अपने UPI ऐप में {price} का भुगतान \"{note}\" नोट के साथ जाँच लें।",
  "bundles.clear": "हटाएँ",
  "bundles.onSale": "अभी बिक्री पर",
  "bundles.nothingOnSale": "अभी कुछ बिक्री पर नहीं है। नीचे से कोई सुझाव पब्लिश करें।",
  "bundles.until": "{when} तक मान्य",
  "bundles.stats": "{sold} बिके · {left} बचे",
  "bundles.reserved": " · {n} रिज़र्व",
  "bundles.sold1": "1 बिका",
  "bundles.takeDown": "बिक्री से हटाएँ",
  "bundles.suggested": "सुझाए गए बंडल",
  "bundles.suggestedHint": "साथ में खरीदी जाने वाली चीज़ों को जोड़ा गया है, एक्सपायरी के हिसाब से छूट दी गई है, और दाम कभी लागत से कम नहीं। आप दाम बदल सकते हैं।",
  "bundles.finding": "बंडल ढूँढ रहे हैं…",
  "bundles.nothingToRescue": "अभी कुछ बचाने की ज़रूरत नहीं है। 2 दिन में एक्सपायर होने वाले आइटम यहाँ दिखेंगे।",
  "bundles.checkStock": "स्टॉक देखें",
  "bundles.expires": "एक्सपायरी: {when}",
  "bundles.nameLabel": "बंडल का नाम",
  "bundles.descLabel": "ग्राहकों के लिए विवरण",
  "bundles.writeAi": "✨ AI से लिखवाएँ",
  "bundles.writing": "लिख रहे हैं…",
  "bundles.priceLabel": "बंडल का दाम",
  "bundles.off": "{n}% छूट",
  "bundles.enoughFor": "{n} के लिए काफ़ी",
  "bundles.publish": "ग्राहक ऑफ़र में पब्लिश करें",
  "bundles.publishing": "पब्लिश हो रहा है…",

  "deals.kicker": "रेस्क्यू ऑफ़र",
  "deals.kickerAt": "{shop} के रेस्क्यू ऑफ़र",
  "deals.title": "अच्छा खाना, कम बर्बादी",
  "deals.intro": "ये ताज़ी चीज़ें हैं जिनकी बेस्ट-बिफ़ोर तारीख पास है। इन्हें छूट पर बंडल किया गया है ताकि कुछ भी कूड़े में न जाए। एक रिज़र्व करें और घंटे भर में ले जाएँ, या यह पेज काउंटर पर दिखाएँ।",
  "deals.missing": "यह दुकान का लिंक मौजूद नहीं है। QR कोड जाँचें या दुकान से पूछें।",
  "deals.loading": "आज के ऑफ़र लोड हो रहे हैं…",
  "deals.none": "अभी कोई ऑफ़र नहीं है। आज बाद में फिर देखें!",
  "deals.rescuedSoFar": "🌱 आप जैसे ग्राहकों की वजह से {shop} अब तक लगभग {kg} किलो खाना बर्बाद होने से बचा चुका है।",
  "deals.off": "{n}% छूट",
  "deals.until": "{when} तक मान्य",
  "deals.onlyLeft": "सिर्फ़ {n} बचे",
  "deals.left": "{n} बचे",
  "deals.reserve": "पिकअप के लिए रिज़र्व करें",
  "deals.yourName": "आपका पहला नाम (ताकि दुकान आपको पहचान सके)",
  "deals.holdNote": "हम इसे 1 घंटे तक रखेंगे। लेते समय काउंटर पर पैसे दें।",
  "deals.reserveFor": "{price} में रिज़र्व करें",
  "deals.reserving": "रिज़र्व हो रहा है…",
  "deals.reserveFailed": "रिज़र्व नहीं हो सका। फिर से कोशिश करें।",
  "deals.reserved": "आपके लिए रिज़र्व ✓",
  "deals.pickupCode": "पिकअप कोड",
  "deals.pickUpBy": "{time} तक ले जाएँ",
  "deals.payAtCounter": "काउंटर पर {price} दें",
  "deals.cantMakeIt": "नहीं आ पाऊँगा, रद्द करें",
  "deals.payUpi": "अभी UPI से {price} दें",
  "deals.payUpiHint": "GPay, PhonePe, Paytm या कोई भी UPI ऐप खुलेगा। आप काउंटर पर भी पैसे दे सकते हैं।",
  "deals.showQr": "कंप्यूटर पर हैं? स्कैन करने के लिए QR कोड दिखाएँ",
  "deals.hideQr": "QR कोड छिपाएँ",
  "deals.paidButton": "मैंने भुगतान कर दिया",
  "deals.paidDone": "भुगतान भेज दिया ✓ काउंटर पर अपना कोड दिखाएँ।",
  "deals.paidCantCancel": "भुगतान कर दिया है? रद्द करने और पैसे वापस लेने के लिए दुकान से कहें।",
  "deals.share": "WhatsApp पर शेयर करें",
  "deals.alerts": "🔔 ऑफ़र की सूचना पाएँ",
  "deals.alertsTitle": "🔔 जब {shop} नया ऑफ़र डाले, तब सूचना पाएँ",
  "deals.alertsFree": "मुफ़्त, कोई अकाउंट नहीं चाहिए, और जब चाहें बंद कर सकते हैं।",
  "deals.alertsBrowser": "इसी फ़ोन या कंप्यूटर पर:",
  "deals.alertsOpen": "सूचना वाला पेज खोलें",
  "deals.alertsBrowserRest": "और Subscribe दबाएँ, फिर सूचनाओं की अनुमति दें।",
  "deals.alertsApp": "या ntfy ऐप से (App Store / Play Store): + दबाएँ और इस टॉपिक को सब्सक्राइब करें:",
  "deals.copied": "कॉपी हो गया ✓",
  "deals.thisShop": "यह दुकान",
  "deals.copy": "कॉपी करें",
  "deals.shareLine": "• {title}: {price} (पहले {was}), {when} तक",
  "deals.shareText": "{shop} के आज के रेस्क्यू ऑफ़र 🥐☕\n\n{lines}\n\nताज़ा खाना, कम दाम, कम बर्बादी। स्टॉक सीमित है:\n{url}",

  "join.checking": "आपका इनवाइट जाँच रहे हैं…",
  "join.title": "{shop} से जुड़ें",
  "join.subtitle": "स्टॉक जोड़ने और रेस्क्यू बंडल बेचने के लिए अपना लॉगिन बनाएँ।",
  "join.name": "आपका नाम",
  "join.email": "ईमेल",
  "join.password": "पासवर्ड",
  "join.passwordHint": "कम से कम 8 अक्षर",
  "join.wait": "रुकिए…",
  "join.submit": "{shop} से जुड़ें",
};

export const DICTS: Record<Lang, Record<Key, string>> = { en, hi };
const STORAGE_KEY = "sl-lang";
const EVENT = "sl-lang-change";

function readLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && saved in LANGS ? (saved as Lang) : "en";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setLang(lang: Lang) {
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The chosen language (saved per device) and a translate function.
 * Pages render in English first and switch right after loading, so prerendered HTML stays valid.
 */
export function useT() {
  const lang = useSyncExternalStore(subscribe, readLang, () => "en" as Lang);
  const t = useCallback(
    (key: Key, vars: Record<string, string | number> = {}) =>
      DICTS[lang][key].replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`)),
    [lang],
  );
  const category = useCallback((c: Category) => t(`cat.${c}` as Key), [t]);
  const unit = useCallback((u: Unit | string) => (`unit.${u}` in en ? t(`unit.${u}` as Key) : u), [t]);
  /** "today", "tomorrow", or a short date in the chosen language. */
  const when = useCallback(
    (expiresOn: string) => {
      const day = new Date(expiresOn + "T00:00:00");
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diff = Math.round((day.getTime() - now.getTime()) / 86400000);
      if (diff === 0) return t("common.today");
      if (diff === 1) return t("common.tomorrow");
      return day.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short", day: "numeric", month: "short" });
    },
    [lang, t],
  );
  const time = useCallback(
    (iso: string) => new Date(iso).toLocaleTimeString(lang === "hi" ? "hi-IN" : "en-IN", { hour: "numeric", minute: "2-digit" }),
    [lang],
  );
  return { lang, t, category, unit, when, time };
}

/** EN | हिं switch. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang } = useT();
  return (
    <div className={`flex overflow-hidden rounded-lg border border-stone-300 text-xs ${className}`} role="group" aria-label="Language">
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 ${lang === l ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:bg-stone-50"}`}
        >
          {LANGS[l]}
        </button>
      ))}
    </div>
  );
}
