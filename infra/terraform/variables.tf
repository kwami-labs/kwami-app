variable "account_id" {
  type        = string
  description = "Cloudflare account ID that owns the Worker and the kwami.io zone."
}

variable "environment" {
  type        = string
  description = "Tier this stack configures: development, staging, or production."

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging, or production."
  }
}

variable "worker_name" {
  type        = string
  description = "Wrangler Worker name for this tier (must match wrangler.jsonc env.name)."
}

variable "zone_id" {
  type        = string
  default     = ""
  description = "Zone that should host the app hostname. Required when enable_custom_domain is true."
}

variable "zone_name" {
  type        = string
  default     = "kwami.io"
  description = "DNS zone name (documentation / outputs). The custom domain uses zone_id."
}

variable "app_hostname" {
  type        = string
  default     = ""
  description = "Public hostname, e.g. app.kwami.io. Do not use the apex — kwami-waitlist owns kwami.io."
}

variable "enable_custom_domain" {
  type        = bool
  default     = false
  description = "Attach app_hostname to the Worker. Keep false until the Worker has been deployed once."
}

variable "enable_zone_tls" {
  type        = bool
  default     = false
  description = "Manage zone-wide TLS settings (ssl=strict, always HTTPS, TLS 1.3). Off by default — it affects the whole zone."
}
