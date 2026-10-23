// Column aliases per platform and entity. Headers are matched case- and punctuation-
// insensitively, and "*" matches a number (Image 1, Image 2 …). Platforms change their exports,
// so run inspect.mjs first and override anything missing in mapping.json (references/mapping.md).
//
// Every platform preset is tried first, then GENERIC, so a CSV from an unknown tool still maps.

export const GENERIC = {
	products: {
		rowType: ['Type', 'Item Type', 'fieldType', 'Row Type', 'Item'],
		id: ['ID', 'Product ID', 'Product Id', 'Item ID', 'ItemId', 'handleId', 'Product ID [Non Editable]'],
		parent: ['Parent', 'Parent ID', 'Parent SKU', 'Parent Product ID'],
		handle: ['Handle', 'Slug', 'URL Key', 'url_key'],
		url: ['Product URL', 'URL', 'Link', 'Product Link', 'Permalink'],
		title: ['Title', 'Name', 'Product Name', 'Product Title', 'name', 'Item Name'],
		description: ['Description', 'Body (HTML)', 'Body HTML', 'Product Description', 'Long Description', 'description'],
		shortDescription: ['Short description', 'Short Description', 'Summary', 'Excerpt'],
		vendor: ['Vendor', 'Brand', 'Brand Name', 'Manufacturer', 'brand'],
		productType: ['Product Type', 'Product Category', 'Category Type'],
		tags: ['Tags', 'Keywords', 'Product Tags'],
		categories: ['Categories', 'Category', 'Collections', 'Collection', 'collection', 'Product Category'],
		status: ['Status', 'Published', 'Visible', 'visible', 'Visibility', 'Active', 'Product Visible?', 'Is Visible'],
		price: ['Price', 'Variant Price', 'price', 'Selling Price'],
		regularPrice: ['Regular price', 'Regular Price', 'Retail Price', 'Original Price', 'List Price'],
		salePrice: ['Sale price', 'Sale Price', 'Special Price', 'SpecialPrice', 'Discounted Price', 'Promotion Price'],
		compareAtPrice: ['Compare At Price', 'Variant Compare At Price', 'Compare-at price', 'MSRP'],
		sku: ['SKU', 'Variant SKU', 'sku', 'Seller SKU', 'SellerSku', 'Product Code/SKU', 'Product Code', 'Item SKU', 'SKU Reference No.'],
		barcode: ['Barcode', 'Variant Barcode', 'GTIN', 'UPC', 'EAN', 'ISBN', 'Product UPC/EAN'],
		inventory: ['Stock', 'Quantity', 'Inventory', 'inventory', 'Stock Quantity', 'Current Stock Level', 'Variant Inventory Qty', 'Available', 'Qty'],
		weight: ['Weight', 'Weight (kg)', 'Weight (g)', 'Weight (lbs)', 'Weight (lb)', 'Product Weight', 'Variant Grams', 'weight', 'Package Weight'],
		images: ['Images', 'Image', 'Image Src', 'Image URL', 'Image URL *', 'Image *', 'Image*', 'Images *', 'Main Image', 'Cover image', 'Hosted Image URLs', 'productImageUrl', 'Product Image URL - *', 'Product Image File - *', 'Item Image *', 'Picture *'],
		optionName1: ['Option1 Name', 'Option Name 1', 'Attribute 1 name', 'productOptionName1', 'Variation Name 1'],
		optionValue1: ['Option1 Value', 'Option Value 1', 'Attribute 1 value(s)', 'productOptionDescription1', 'Variation Value 1'],
		optionName2: ['Option2 Name', 'Option Name 2', 'Attribute 2 name', 'productOptionName2', 'Variation Name 2'],
		optionValue2: ['Option2 Value', 'Option Value 2', 'Attribute 2 value(s)', 'productOptionDescription2', 'Variation Value 2'],
		optionName3: ['Option3 Name', 'Option Name 3', 'Attribute 3 name', 'productOptionName3'],
		optionValue3: ['Option3 Value', 'Option Value 3', 'Attribute 3 value(s)', 'productOptionDescription3'],
		variation: ['Variation', 'Variation Name', 'Variant', 'Variant Name', 'Options', 'Variation value'],
		seoTitle: ['SEO Title', 'Meta Title', 'Page Title', 'meta_title'],
		seoDescription: ['SEO Description', 'Meta Description', 'meta_description'],
	},
	customers: {
		id: ['ID', 'Customer ID', 'user_id', 'Contact ID'],
		email: ['Email', 'E-mail', 'Email Address', 'user_email', 'Email 1', 'billing_email', 'Customer Email', 'Contact email'],
		firstName: ['First Name', 'First name', 'first_name', 'Given Name', 'billing_first_name'],
		lastName: ['Last Name', 'Last name', 'last_name', 'Family Name', 'Surname', 'billing_last_name'],
		name: ['Name', 'Full Name', 'Customer Name', 'display_name', 'Billing Name'],
		phone: ['Phone', 'Phone Number', 'Mobile', 'Phone 1', 'billing_phone', 'Telephone', 'Default Address Phone'],
		acceptsMarketing: ['Accepts Marketing', 'Accepts Email Marketing', 'Email subscriber status', 'Subscribed', 'Newsletter', 'Marketing Opt-in', 'accepts_marketing', 'Receive Review/Abandoned Cart Emails?', 'Email Marketing Status'],
		createdAt: ['Created At', 'Created', 'Date Joined', 'Sign up date', 'user_registered', 'Date registered', 'Created At (UTC+0)', 'Customer Since', 'Created On'],
		tags: ['Tags', 'Labels', 'Customer Group', 'Groups', 'Segments'],
		note: ['Note', 'Notes', 'Comment'],
		company: ['Company', 'Company Name', 'billing_company', 'Default Address Company'],
		address1: ['Address 1', 'Address1', 'Address', 'Street', 'Address 1 - Street', 'billing_address_1', 'Default Address Address1', 'Address Line 1', 'Street Address'],
		address2: ['Address 2', 'Address2', 'billing_address_2', 'Default Address Address2', 'Address Line 2'],
		city: ['City', 'Address 1 - City', 'billing_city', 'Default Address City', 'Town'],
		province: ['Province', 'State', 'Region', 'Province Code', 'Address 1 - State/Region', 'billing_state', 'Default Address Province Code', 'State/Province'],
		zip: ['Zip', 'Postcode', 'Postal code', 'Postal Code', 'ZIP Code', 'Address 1 - Zip', 'billing_postcode', 'Default Address Zip'],
		country: ['Country', 'Country Code', 'Country / Region', 'Address 1 - Country', 'billing_country', 'Default Address Country Code'],
		locale: ['Language', 'Locale', 'locale'],
	},
	orders: {
		number: ['Order Number', 'Order ID', 'Order #', 'Order no.', 'Order No', 'Order', 'order_number', 'Name', 'Order Id'],
		date: ['Order Date', 'Created at', 'Date created', 'Date', 'Order Creation Date', 'Created', 'order_date', 'Order Created Time'],
		paidAt: ['Paid at', 'Paid Date', 'Payment Date', 'date_paid', 'Paid Time'],
		closedAt: ['Fulfilled at', 'Completed Date', 'Delivered Date', 'Order Complete Time', 'date_completed'],
		status: ['Order Status', 'Status', 'status'],
		paymentStatus: ['Financial Status', 'Payment Status', 'Payment status'],
		fulfillmentStatus: ['Fulfillment Status', 'Fulfillment status', 'Shipping Status'],
		currency: ['Currency', 'Order Currency'],
		email: ['Email', 'Customer Email', 'Billing Email', 'Billing Email Address', 'Contact email', 'billing_email', 'Buyer Email'],
		firstName: ['Billing First Name', 'billing_first_name', 'First Name'],
		lastName: ['Billing Last Name', 'billing_last_name', 'Last Name'],
		billingName: ['Billing Name', 'Customer Name', 'Buyer Name', 'Buyer Username'],
		phone: ['Billing Phone', 'Billing Phone Number', 'Phone', 'Phone Number', 'billing_phone'],
		lineTitle: ['Lineitem name', 'Item Name', 'Product Name', 'Item', 'Product', 'Line Item Name', 'name'],
		lineSku: ['Lineitem sku', 'SKU', 'Item SKU', 'Product SKU', 'SKU Reference No.', 'Seller SKU', 'SellerSku', 'sku'],
		lineVariant: ['Variation Name', 'Variation', 'Variant', 'Lineitem variant'],
		lineQty: ['Lineitem quantity', 'Quantity', 'Qty', 'Item Quantity', 'qty'],
		linePrice: ['Lineitem price', 'Item Cost', 'Item Price', 'Unit Price', 'Price', 'Deal Price', 'Paid Price', 'SKU Unit Original Price'],
		lineTotal: ['Item Total', 'Line Total', 'Order Line Total', 'Lineitem total', 'SKU Subtotal After Discount'],
		shipping: ['Shipping', 'Shipping Total', 'Order Shipping Amount', 'Shipping Fee', 'Shipping Cost', 'Shipping Rate', 'Shipping Cost (inc tax)', 'shipping_total', 'Buyer Paid Shipping Fee'],
		shippingTitle: ['Shipping Method', 'Shipping Method Title', 'Shipping Option', 'Delivery Method'],
		discount: ['Discount Amount', 'Cart Discount Amount', 'Discount Total', 'Discount', 'Order Discount', 'Voucher', 'Seller Voucher', 'discount_total'],
		discountCode: ['Discount Code', 'Coupon Code', 'Coupons Used', 'Coupon code', 'Coupons', 'coupon_code'],
		tax: ['Taxes', 'Tax', 'Tax Total', 'Order Tax Amount', 'Total Tax', 'tax_total'],
		total: ['Total', 'Order Total', 'Order Total Amount', 'Total Amount', 'Grand Total', 'Order Total (inc tax)', 'order_total', 'Order Amount'],
		refunded: ['Amount Refunded', 'Refunded Total', 'Order Refund Amount', 'Refund Amount'],
		gateway: ['Payment Method', 'Payment Method Title', 'Gateway', 'Payment Gateway'],
		note: ['Notes', 'Note', 'Customer Note', 'Customer Provided Note', 'Buyer Message', 'customer_note'],
		// Address parts; "{P}" is replaced by Billing / Shipping.
		addrName: ['{P} Name', '{P} Full Name'],
		addrFirst: ['{P} First Name', '{P}_first_name'],
		addrLast: ['{P} Last Name', '{P}_last_name'],
		addrCompany: ['{P} Company', '{P}_company'],
		addr1: ['{P} Address1', '{P} Address 1', '{P} Street', '{P}_address_1', '{P} Address'],
		addr2: ['{P} Address2', '{P} Address 2', '{P}_address_2'],
		addrCity: ['{P} City', '{P}_city'],
		addrProvince: ['{P} Province', '{P} State', '{P} State Code', '{P} Province Code', '{P}_state', '{P} Region'],
		addrZip: ['{P} Zip', '{P} Postcode', '{P} Postal Code', '{P}_postcode'],
		addrCountry: ['{P} Country', '{P} Country Code', '{P}_country'],
		addrPhone: ['{P} Phone', '{P}_phone'],
	},
	discounts: {
		code: ['Code', 'Coupon Code', 'Discount Code', 'Voucher Code', 'Promo Code', 'Name'],
		type: ['Type', 'Discount Type', 'Coupon Type', 'discount_type'],
		value: ['Value', 'Amount', 'Discount Value', 'Coupon Amount', 'coupon_amount', 'Discount'],
		minimumSubtotal: ['Minimum Spend', 'Minimum Subtotal', 'Min Order', 'Minimum Order Amount', 'minimum_amount', 'Min. Spend'],
		startsAt: ['Starts At', 'Start Date', 'Valid From', 'Start Time'],
		endsAt: ['Ends At', 'End Date', 'Expiry Date', 'Expires', 'Valid Until', 'date_expires', 'End Time'],
		usageLimit: ['Usage Limit', 'Max Uses', 'Total Usage Limit', 'usage_limit', 'Quantity'],
		usedCount: ['Used', 'Usage Count', 'Times Used', 'usage_count'],
		oncePerCustomer: ['Once Per Customer', 'Usage Limit Per User', 'Limit Per Customer', 'usage_limit_per_user'],
		customerEmails: ['Customer Emails', 'Allowed Emails', 'Email Restrictions', 'customer_email'],
	},
};

/** Platform presets: extra aliases tried before GENERIC, plus small transforms. */
export const PLATFORMS = {
	woocommerce: {
		label: 'WooCommerce (Products → Export CSV; customers/orders via Analytics, a plugin or the REST API)',
		products: {
			rowType: ['Type'],
			status: ['Published'],
			weight: ['Weight (kg)', 'Weight (lbs)', 'Weight (g)', 'Weight (oz)'],
		},
		rowTypes: { variant: ['variation'], product: ['simple', 'variable', 'external', 'grouped'] },
		orders: {},
		customers: {},
	},
	shopee: {
		label: 'Shopee (Seller Centre → My Products → Mass Update / Export; save the .xlsx as CSV)',
		products: { id: ['Product ID', 'et_title_product_id'], group: ['Parent SKU', 'Product ID'], title: ['Product Name', 'et_title_product_name'], variation: ['Variation Name', 'et_title_variation_name'], sku: ['SKU', 'Variation SKU', 'SKU Reference No.'], images: ['Cover image', 'Item Image *', 'Image *'] },
		noCustomers: 'Shopee does not share buyer emails, so there are no customers to import. Ask buyers to join the new store instead (welcome voucher in parcels).',
	},
	lazada: {
		label: 'Lazada (Seller Center → Products → Manage Products → Export; save the .xlsx as CSV)',
		products: { group: ['Product ID', 'ItemId', 'Item ID'], title: ['Product Name', '*Product Name(English)', 'name'], sku: ['SellerSku', 'Seller SKU', 'SkuId'], salePrice: ['SpecialPrice', 'Special Price'], inventory: ['Quantity', 'quantity', 'Stock'], images: ['MainImage', 'Main Image', 'Image*', 'Image *'], variation: ['color_family', 'Variation', 'size'] },
		noCustomers: 'Lazada does not share buyer emails, so there are no customers to import.',
	},
	tiktok: {
		label: 'TikTok Shop (Seller Center → Products → Batch tools / Export; save the .xlsx as CSV)',
		products: { group: ['Product ID', 'product_id'], title: ['Product Name', 'Product name', 'product_name'], sku: ['Seller SKU', 'seller_sku', 'SKU ID'], variation: ['Variation', 'Variation value', 'Sales attribute'], images: ['Main Image', 'Main image', 'Image *', 'Product image *'] },
		noCustomers: 'TikTok Shop does not share buyer emails, so there are no customers to import.',
	},
	wix: {
		label: 'Wix (Store Products → More Actions → Export; Contacts → Export; Orders → Export)',
		products: { group: ['handleId'], rowType: ['fieldType'], status: ['visible'], images: ['productImageUrl'], categories: ['collection'] },
		rowTypes: { variant: ['variant'], product: ['product'] },
		customers: { email: ['Email 1', 'Email'], phone: ['Phone 1', 'Phone'], acceptsMarketing: ['Email subscriber status'] },
	},
	squarespace: {
		label: 'Squarespace (Commerce → Inventory → Export; Profiles → Export; Orders → Download CSV; blog via Settings → Export → WordPress XML)',
		products: { id: ['Product ID [Non Editable]'], url: ['Product URL'], images: ['Hosted Image URLs'], status: ['Visible'] },
	},
	bigcommerce: {
		label: 'BigCommerce (Products → Export; Customers → Export; Orders → Export)',
		products: { rowType: ['Item Type', 'Item'], id: ['Product ID', 'ID'], title: ['Product Name', 'Name'], sku: ['Product Code/SKU', 'SKU'], inventory: ['Current Stock Level', 'Current Stock'], status: ['Product Visible?', 'Is Visible'], url: ['Product URL'], seoTitle: ['Page Title'] },
		rowTypes: { variant: ['sku', 'variant'], product: ['product'], skip: ['rule', 'modifier'] },
	},
	magento: {
		label: 'Magento / Adobe Commerce (System → Data Transfer → Export, entity Products / Customers Main File)',
		products: { handle: ['url_key'], title: ['name'], description: ['description'], shortDescription: ['short_description'], price: ['price'], salePrice: ['special_price'], inventory: ['qty'], status: ['product_online'], images: ['base_image', 'additional_images'], categories: ['categories'], rowType: ['product_type'] },
		rowTypes: { product: ['simple', 'configurable', 'virtual', 'bundle', 'grouped'] },
		customers: { email: ['email'], firstName: ['firstname'], lastName: ['lastname'], createdAt: ['created_at'] },
	},
	shopify: {
		label: 'Another Shopify store (Products → Export, Customers → Export): or use the Store Importer / Matrixify',
		products: { group: ['Handle'], handle: ['Handle'], description: ['Body (HTML)'], optionName1: ['Option1 Name'], optionValue1: ['Option1 Value'] },
	},
	csv: { label: 'Any CSV / spreadsheet: map columns in mapping.json' },
	wordpress: { label: 'WordPress XML (Tools → Export): posts, pages, WooCommerce coupons; Squarespace exports the same format' },
};

/** Guess the platform from a header row (for inspect.mjs). */
export function detectPlatform(headers) {
	const h = new Set(headers.map((x) => x.toLowerCase().trim()));
	const has = (...xs) => xs.every((x) => h.has(x.toLowerCase()));
	if (has('handleId', 'fieldType')) return 'wix';
	if (has('Product ID [Non Editable]') || has('Hosted Image URLs')) return 'squarespace';
	if (has('Item Type', 'Product Code/SKU') || has('Product Code/SKU')) return 'bigcommerce';
	if (has('Attribute 1 name') || has('Regular price', 'Sale price', 'Published')) return 'woocommerce';
	if (has('user_email') || has('billing_email')) return 'woocommerce';
	if (has('url_key') || has('product_websites')) return 'magento';
	if (has('Handle', 'Body (HTML)') || has('Handle', 'Variant SKU')) return 'shopify';
	if (has('Parent SKU') || has('et_title_product_id') || has('SKU Reference No.')) return 'shopee';
	if (has('SellerSku') || has('SpecialPrice') || has('MainImage')) return 'lazada';
	if (has('Seller SKU', 'SKU ID') || has('seller_sku')) return 'tiktok';
	return 'csv';
}

/** Guess the entity from a header row. */
export function detectEntity(headers) {
	const s = headers.join(' ').toLowerCase();
	if (/lineitem|order (id|number|#|no)|order status|order date|order creation/.test(s)) return 'orders';
	if (/coupon|voucher code|discount code|promo code/.test(s) && !/product name/.test(s)) return 'discounts';
	if (/sku|price|product name|handleid|regular price|stock|inventory/.test(s)) return 'products';
	if (/email/.test(s)) return 'customers';
	return null;
}
