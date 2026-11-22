# Tracking API Guide

## Authentication

All requests need an API key sent in the `X-Api-Key` header. Keys are created in the dashboard under Settings, then Developers. A key can be restricted to read-only access. Rotate keys every 90 days; a rotated key stays valid for 24 hours so integrations can switch over without downtime.

## Rate limits

The API allows 120 requests per minute per key. Requests over the limit receive HTTP 429 with a `Retry-After` header that gives the wait time in seconds. Bulk lookups should use the batch endpoint instead of many single calls.

## Get a parcel status

`GET /v2/parcels/{trackingNumber}` returns the current status, the last scan location, and the estimated delivery date. Status is one of: `created`, `in_transit`, `out_for_delivery`, `delivered`, `exception`, `returned`.

## Batch lookup

`POST /v2/parcels/batch` accepts up to 100 tracking numbers in one request and returns a status object for each. Unknown tracking numbers are returned with status `not_found` and do not fail the whole request.

## Webhooks

Webhooks send a POST request to your endpoint whenever a parcel status changes. Each delivery is signed with an HMAC-SHA256 signature in the `X-Parcelwise-Signature` header. Failed deliveries are retried up to 5 times with exponential backoff, starting at 30 seconds. Your endpoint must answer with a 2xx status within 10 seconds.

## Errors

Errors use standard HTTP status codes with a JSON body containing `code` and `message`. A 401 means the key is missing or invalid. A 403 means the key lacks permission for that endpoint. A 404 means the tracking number does not exist.

## Sandbox

The sandbox base URL is `https://sandbox.parcelwise.example`. Sandbox tracking numbers that start with `TEST` cycle through every status once per minute, which makes webhook testing easier.
