import { SITE } from './site.js';

// Starting text for the policy pages, editable in Admin > Policies. Written for an Indian furniture store taking
// online payments; the business should read and adjust it before launch.
export const POLICY_PAGES = [
  { key: 'privacy', slug: 'privacy-policy', title: 'Privacy Policy' },
  { key: 'terms', slug: 'terms-and-conditions', title: 'Terms & Conditions' },
  { key: 'refund', slug: 'refund-policy', title: 'Refund & Return Policy' },
];

export const DEFAULT_POLICIES = {
  privacy: `## What we collect
When you create an account or place an order we collect your name, email address, phone number and delivery address. Sign-in is handled by Google Firebase Authentication; if you sign in with Google we receive your name and email from Google.

## How we use it
- To process and deliver your orders and send order updates by email
- To answer your questions and provide after-sales support
- To remember your cart, wishlist and saved addresses
- To improve the website and our range

## Payments
Payments are processed by Razorpay. We never see or store your card, UPI or bank details — they go directly to Razorpay over an encrypted connection.

## Sharing
We share your details only with the people needed to fulfil your order: our delivery and installation team, Razorpay for payments, and Google for sign-in. We do not sell your information to anyone.

## Cookies and storage
The website uses your browser's storage to keep you signed in and to remember your cart. We do not use advertising cookies.

## Your choices
You can update your name, phone and addresses from your account at any time. To delete your account or ask what information we hold about you, email ${SITE.email}.

## Contact
${SITE.name}, ${SITE.address}. Email ${SITE.email}, phone ${SITE.phone}.`,

  terms: `## About us
This website is operated by ${SITE.name} (GSTIN ${SITE.gstin}), ${SITE.address}. By placing an order you agree to these terms.

## Prices and payment
- All prices are in Indian Rupees and include GST. Delivery and installation are free unless stated otherwise on the product page.
- Prices and offers may change without notice; the price shown at checkout is the price you pay.
- Payment is taken in full at the time of ordering through Razorpay. An order is confirmed only when the payment succeeds.
- Dealer and distributor prices are available only to approved trade accounts.

## Orders and delivery
- You will receive an email confirmation with your invoice once payment succeeds, and further emails as the order is packed, shipped and delivered.
- Delivery times are estimates. Large items may be delivered in parts and assembled at your address.
- Please make sure someone is available to receive the delivery and that the item will fit through doors, lifts and stairways. Re-delivery because of access problems may be charged.
- Please inspect the item at delivery and report any damage within 48 hours with photographs.

## Cancellations
Orders can be cancelled free of charge before they are dispatched. Contact us with your order number at ${SITE.email} or ${SITE.phone}. Once an item has been dispatched, the Refund & Return Policy applies.

## Products
Natural materials such as wood, leather and stone vary in grain, colour and texture; such variation is not a defect. Colours may look slightly different on screen. Dimensions are approximate.

## Warranty
Products carry the manufacturer warranty stated on the product page, covering manufacturing defects under normal household or office use. It does not cover normal wear, misuse, incorrect assembly by third parties, or damage from moisture or heat.

## Website
All content on this website belongs to ${SITE.name} and may not be reproduced without permission. We may update these terms from time to time; the version published here applies.

## Governing law
These terms are governed by the laws of India. Disputes are subject to the courts of Hyderabad, Telangana.`,

  refund: `## Damaged or defective on arrival
If an item arrives damaged, defective or different from what you ordered, tell us within 48 hours of delivery at ${SITE.email} or ${SITE.phone} with your order number and photographs. We will repair or replace it, or refund you in full, at no cost to you.

## Change of mind
Because furniture is bulky and often made to order, we do not accept returns for change of mind once an item has been delivered and installed. Please check dimensions, colours and materials carefully before ordering, and contact us if you would like to see a product before buying.

## Cancelling before dispatch
You may cancel an order free of charge at any time before it is dispatched. The full amount is refunded.

## Refunds
- Refunds are made to the original payment method through Razorpay.
- Once a refund is approved it is issued within 2 working days; your bank or card provider may take a further 5 to 10 working days to show it.
- You will receive an email when the refund has been issued.

## Incomplete payments
If a payment fails or you leave checkout before paying, no order is confirmed and nothing is charged. If money was deducted but the order shows as unpaid, Razorpay normally reverses it within 5 to 7 working days; contact us if it does not.

## Contact
${SITE.name}, ${SITE.address}. Email ${SITE.email}, phone ${SITE.phone}.`,
};
