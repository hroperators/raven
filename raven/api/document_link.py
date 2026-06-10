import frappe
from frappe.desk.utils import slug
from frappe.model import no_value_fields, table_fields
from frappe.utils import get_url


def get_new_app_document_links(doctype, docname):
	"""
	New apps like Frappe CRM etc have a different link.
	"""
	# TODO: Add the other app routes here
	routes = {
		"CRM Lead": "/crm/leads/",
	}

	return routes.get(doctype) + docname if doctype in routes else None


@frappe.whitelist(methods=["GET"])
def get(doctype: str, docname: str | int, with_site_url: bool = True):

	document_link_override = frappe.get_hooks("raven_document_link_override")
	if document_link_override and len(document_link_override) > 0:

		# Loop over all the hooks and return the first non-None value
		for hook in document_link_override:
			link = frappe.get_attr(hook)(doctype, docname)
			if link:
				if with_site_url:
					return get_url() + link
				return link

	if with_site_url:
		return frappe.utils.get_url() + f"/app/{slug(doctype)}/{docname}"

	return f"/app/{slug(doctype)}/{docname}"


@frappe.whitelist(methods=["GET"])
def get_preview_data(doctype: str, docname: str | int):
	preview_fields = []
	meta = frappe.get_meta(doctype)

	preview_fields = [
		field.fieldname
		for field in meta.fields
		if field.in_preview
		and field.fieldtype not in no_value_fields
		and field.fieldtype not in table_fields
	]

	# no preview fields defined, build list from mandatory fields
	if not preview_fields:
		preview_fields = [
			field.fieldname for field in meta.fields if field.reqd and field.fieldtype not in table_fields
		]

	title_field = meta.get_title_field()
	image_field = meta.image_field

	if doctype == "Customer":
		for fieldname in ("customer_primary_address", "customer_primary_contact", "customer_custom_drive"):
			if meta.has_field(fieldname):
				preview_fields.append(fieldname)

	preview_fields.append(title_field)
	preview_fields.append(image_field)
	preview_fields.append("name")

	preview_data = frappe.get_list(doctype, filters={"name": docname}, fields=preview_fields, limit=1)

	if not preview_data:
		return

	preview_data = preview_data[0]

	formatted_preview_data = {
		"preview_image": preview_data.get(image_field),
		"preview_title": preview_data.get(title_field),
		"id": preview_data.get("name"),
		"raven_document_link": get(doctype, docname),
	}

	customer_custom_labels = {
		"customer_primary_address": "Primary Address",
		"customer_primary_contact": "Primary Contact",
		"customer_custom_drive": "Customer Drive Link",
	}

	for key, val in preview_data.items():
		if val and meta.has_field(key) and key not in [image_field, title_field, "name"]:
			if doctype == "Customer" and key == "customer_primary_address":
				formatted_preview_data[customer_custom_labels[key]] = _format_customer_primary_address(val)
				continue

			if doctype == "Customer" and key == "customer_primary_contact":
				formatted_preview_data[customer_custom_labels[key]] = _format_customer_primary_contact(val)
				continue

			if doctype == "Customer" and key == "customer_custom_drive":
				formatted_preview_data[customer_custom_labels[key]] = _format_customer_drive_link(val)
				continue

			formatted_preview_data[meta.get_field(key).label] = frappe.format(
				val,
				meta.get_field(key).fieldtype,
				translated=True,
			)

	return formatted_preview_data


@frappe.whitelist(methods=["GET"])
def get_card_menu_actions(doctype: str, docname: str | int):
	"""Return extra actions for Raven linked-document cards (via app hooks)."""
	actions = []
	for hook in frappe.get_hooks("raven_document_card_menu_actions") or []:
		items = frappe.get_attr(hook)(doctype, docname) or []
		if isinstance(items, dict):
			items = [items]
		actions.extend(items)
	return actions


@frappe.whitelist(methods=["POST"])
def update_preview_fields(doctype: str, fields: list[str]):

	meta = frappe.get_meta(doctype)

	existing_preview_fields = [
		field.fieldname
		for field in meta.fields
		if field.in_preview
		and field.fieldtype not in no_value_fields
		and field.fieldtype not in table_fields
	]
	fields_to_remove = set(existing_preview_fields) - set(fields)

	for field in fields_to_remove:
		delete_property_setter(doctype, field_name=field, property="in_preview")

	for field in fields:
		meta_df = meta.get_field(field)
		if not meta_df:
			continue

		delete_property_setter(doctype, field_name=field, property="in_preview")

		# Check if a property setter needs to be created for this field - if the field was already in preview, we don't need to do anything
		is_in_preview_by_default = frappe.db.get_value(
			"DocField", {"parent": doctype, "fieldname": field}, "in_preview"
		)

		if is_in_preview_by_default:
			# No need to create a property setter
			continue

		# create a new property setter
		frappe.make_property_setter(
			{
				"doctype": doctype,
				"doctype_or_field": "DocField",
				"fieldname": field,
				"property": "in_preview",
				"value": "1",
				"property_type": "Check",
			},
			is_system_generated=False,
		)


def delete_property_setter(doc_type, property=None, field_name=None, row_name=None):
	"""delete other property setters on this, if this is new"""
	filters = {"doc_type": doc_type}
	if property:
		filters["property"] = property

	if field_name:
		filters["field_name"] = field_name
	if row_name:
		filters["row_name"] = row_name

	property_setters = frappe.db.get_values("Property Setter", filters)
	for ps in property_setters:
		frappe.get_doc("Property Setter", ps).delete(force=True)


def _format_customer_primary_address(address_name):
	address_name = str(address_name).strip()
	if not address_name:
		return ""

	addr = frappe.db.get_value(
		"Address",
		address_name,
		["address_title", "address_line1", "address_line2", "city", "state", "pincode"],
		as_dict=True,
	)
	if not addr:
		return address_name

	line1 = (addr.get("address_line1") or "").strip()
	line2 = (addr.get("address_line2") or "").strip()
	city = (addr.get("city") or "").strip()
	state = (addr.get("state") or "").strip()
	pincode = (addr.get("pincode") or "").strip()
	city_state_zip = " ".join([part for part in [city, state, pincode] if part]).strip()

	parts = [part for part in [line1, line2, city_state_zip] if part]
	return "<br>".join(parts) if parts else address_name


def _format_customer_primary_contact(contact_name):
	contact_name = str(contact_name).strip()
	if not contact_name:
		return ""

	first_name, last_name = frappe.db.get_value("Contact", contact_name, ["first_name", "last_name"]) or (
		None,
		None,
	)
	full_name = " ".join([part for part in [first_name, last_name] if part]).strip()
	return full_name or contact_name


def _format_customer_drive_link(raw_value):
	url = str(raw_value).strip()
	if not url:
		return ""

	if not (url.startswith("http://") or url.startswith("https://")):
		url = f"https://{url}"

	safe_url = frappe.utils.escape_html(url)
	return (
		f'<a href="{safe_url}" target="_blank" rel="noopener noreferrer">'
		"Customer Drive Link"
		"</a>"
	)
