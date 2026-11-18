"""Allowlisted currency information for the external customer workspace."""


def public_currency_snapshot(snapshot):
    if not snapshot:
        return None
    amounts = ("base_amount", "tax_amount", "total_amount")
    line_fields = ("description", "quantity", "unit_price", "tax_rate", "subtotal", "total")
    return {
        "currency": snapshot["currency"],
        "eur_rate": snapshot["eur_rate"],
        "rate_date": snapshot["rate_date"],
        "original_amounts": {key: snapshot["original_amounts"][key] for key in amounts if key in snapshot["original_amounts"]},
        "eur_amounts": {key: snapshot["eur_amounts"][key] for key in amounts if key in snapshot["eur_amounts"]},
        "original_lines": [{key: line[key] for key in line_fields if key in line} for line in snapshot.get("original_lines", [])],
        "rounding_difference_eur": snapshot.get("rounding_difference_eur"),
    }
