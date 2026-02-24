#!/bin/bash

# Stripe Add-on Setup Script
# This script creates the necessary Stripe prices for all add-ons

echo "🚀 Setting up Stripe Add-on Prices..."

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI not found. Please install it first:"
    echo "   npm install -g stripe-cli"
    exit 1
fi

# Login to Stripe (if not already logged in)
echo "📝 Please login to Stripe..."
stripe login

# Create prices for each add-on
echo "💳 Creating Stripe prices..."

# Extra Pages - €99/month
stripe prices create \
  --currency=eur \
  --unit-amount=9900 \
  --recurring interval=month \
  --lookup-key=extra_pages_monthly \
  --product-data name="Extra 5.000 Seiten/Monat" \
  --product-data description="5.000 zusätzliche Seiten KI-Analysekapazität"

# Extra Users - €199/month
stripe prices create \
  --currency=eur \
  --unit-amount=19900 \
  --recurring interval=month \
  --lookup-key=extra_users_monthly \
  --product-data name="Extra 10 Benutzerplätze" \
  --product-data description="10 zusätzliche Benutzerplätze"

# Premium Support - €199/month
stripe prices create \
  --currency=eur \
  --unit-amount=19900 \
  --recurring interval=month \
  --lookup-key=premium_support_monthly \
  --product-data name="Premium-Support (24/7 Telefon)" \
  --product-data description="Rund-um-die-Uhr-Telefonsupport mit 1h Antwortzeit"

# Custom Templates - €499 once
stripe prices create \
  --currency=eur \
  --unit-amount=49900 \
  --lookup-key=custom_templates_onetime \
  --product-data name="Individuelle Vorlagen-Entwicklung" \
  --product-data description="Maßgeschneiderte Dokumentvorlagen"

# Migration & Onboarding - €999 once
stripe prices create \
  --currency=eur \
  --unit-amount=99900 \
  --lookup-key=migration_onboarding_onetime \
  --product-data name="Migration & Onboarding" \
  --product-data description="White-Glove-Migration mit persönlichem Training"

# Dedicated Infrastructure - €499/month
stripe prices create \
  --currency=eur \
  --unit-amount=49900 \
  --recurring interval=month \
  --lookup-key=dedicated_infra_monthly \
  --product-data name="Dedizierte Infrastruktur" \
  --product-data description="Isolierte Rechen- und Speicherressourcen"

# Extra 5M AI Credits - €99/month
stripe prices create \
  --currency=eur \
  --unit-amount=9900 \
  --recurring interval=month \
  --lookup-key=ai_credits_5m_monthly \
  --product-data name="Extra 5 Mio. AI Credits/Monat" \
  --product-data description="5 Millionen zusätzliche AI Credits"

# Extra 20M AI Credits - €299/month
stripe prices create \
  --currency=eur \
  --unit-amount=29900 \
  --recurring interval=month \
  --lookup-key=ai_credits_20m_monthly \
  --product-data name="Extra 20 Mio. AI Credits/Monat" \
  --product-data description="20 Millionen zusätzliche AI Credits"

echo "✅ Stripe prices created successfully!"
echo ""
echo "📋 Add the following to your .env file:"
echo "STRIPE_PRICE_EXTRA_PAGES_MONTHLY=price_XXXXX"
echo "STRIPE_PRICE_EXTRA_USERS_MONTHLY=price_XXXXX"
echo "STRIPE_PRICE_PREMIUM_SUPPORT_MONTHLY=price_XXXXX"
echo "STRIPE_PRICE_CUSTOM_TEMPLATES_ONETIME=price_XXXXX"
echo "STRIPE_PRICE_MIGRATION_ONETIME=price_XXXXX"
echo "STRIPE_PRICE_DEDICATED_INFRA_MONTHLY=price_XXXXX"
echo "STRIPE_PRICE_AI_CREDITS_5M_MONTHLY=price_XXXXX"
echo "STRIPE_PRICE_AI_CREDITS_20M_MONTHLY=price_XXXXX"
echo ""
echo "🔧 Replace XXXXX with the actual price IDs from the output above"
