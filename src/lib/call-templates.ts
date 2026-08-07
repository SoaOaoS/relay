// Pre-prepared phone call templates — each defines the fields the user fills in,
// and how to build the assistant instructions + context from those fields.

export interface CallField {
  key: string
  label: string
  type: 'text' | 'tel' | 'date' | 'time' | 'number' | 'select'
  placeholder?: string
  required: boolean
  options?: string[] // for select
  description?: string
}

export interface CallTemplate {
  id: string
  label: string
  icon: string // lucide icon name
  description: string
  fields: CallField[]
  // Build the Vapi assistantOverrides.instructions + variableValues from the field values
  buildInstructions: (v: Record<string, string>) => string
  buildContext: (v: Record<string, string>) => string
}

export const CALL_TEMPLATES: CallTemplate[] = [
  {
    id: 'appointment',
    label: 'Appointment',
    icon: 'Calendar',
    description: 'Book, reschedule, or cancel an appointment',
    fields: [
      { key: 'business', label: 'Business / place', type: 'text', placeholder: 'Dr. Martin dental clinic', required: true },
      { key: 'purpose', label: 'Purpose', type: 'select', options: ['New appointment', 'Reschedule', 'Cancel', 'Confirm'], required: true },
      { key: 'date', label: 'Preferred date', type: 'date', placeholder: '2026-08-15', required: false },
      { key: 'time', label: 'Preferred time', type: 'time', placeholder: '14:30', required: false },
      { key: 'name', label: 'Your name', type: 'text', placeholder: 'Raphaël Girard', required: true },
      { key: 'notes', label: 'Additional notes', type: 'text', placeholder: 'Morning preferably, allergic to penicillin', required: false },
    ],
    buildInstructions: (v) => `You are calling ${v.business} on behalf of ${v.name} to ${v.purpose.toLowerCase()}.
${v.date ? `Preferred date: ${v.date}${v.time ? ` at ${v.time}` : ''}.` : 'No specific date — ask for the earliest availability.'}
${v.notes ? `Additional context: ${v.notes}` : ''}
Be polite and concise. If they cannot accommodate the request, ask for alternatives. Confirm the final appointment details before ending the call.`,
    buildContext: (v) => `Call ${v.business} for ${v.name}. Purpose: ${v.purpose}.${v.date ? ` Preferred: ${v.date}${v.time ? ` at ${v.time}` : ''}.` : ' Ask for earliest availability.'}${v.notes ? ` Notes: ${v.notes}` : ''}`,
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    icon: 'UtensilsCrossed',
    description: 'Make a restaurant reservation',
    fields: [
      { key: 'restaurant', label: 'Restaurant name', type: 'text', placeholder: 'Le Bistro Parisien', required: true },
      { key: 'date', label: 'Date', type: 'date', placeholder: '2026-08-15', required: true },
      { key: 'time', label: 'Time', type: 'time', placeholder: '20:00', required: true },
      { key: 'partySize', label: 'Number of guests', type: 'number', placeholder: '4', required: true },
      { key: 'name', label: 'Reservation name', type: 'text', placeholder: 'Raphaël Girard', required: true },
      { key: 'notes', label: 'Special requests', type: 'text', placeholder: 'Window table, birthday dessert', required: false },
    ],
    buildInstructions: (v) => `You are calling ${v.restaurant} to make a reservation for ${v.name}.
Date: ${v.date} at ${v.time}. Party size: ${v.partySize} guests.
${v.notes ? `Special requests: ${v.notes}` : ''}
If the requested slot is unavailable, ask for the closest alternative. Confirm the reservation details before ending the call.`,
    buildContext: (v) => `Reserve a table at ${v.restaurant} for ${v.name}. ${v.partySize} guests on ${v.date} at ${v.time}.${v.notes ? ` Special requests: ${v.notes}` : ''} If the slot is unavailable, ask for the closest alternative and confirm the booking.`,
  },
  {
    id: 'hotel',
    label: 'Hotel',
    icon: 'BedDouble',
    description: 'Book or enquiry about a hotel room',
    fields: [
      { key: 'hotel', label: 'Hotel name', type: 'text', placeholder: 'Hôtel Le Marais', required: true },
      { key: 'checkIn', label: 'Check-in date', type: 'date', placeholder: '2026-08-20', required: true },
      { key: 'checkOut', label: 'Check-out date', type: 'date', placeholder: '2026-08-23', required: true },
      { key: 'guests', label: 'Number of guests', type: 'number', placeholder: '2', required: true },
      { key: 'roomType', label: 'Room type', type: 'select', options: ['Single', 'Double', 'Suite', 'No preference'], required: false },
      { key: 'name', label: 'Guest name', type: 'text', placeholder: 'Raphaël Girard', required: true },
      { key: 'notes', label: 'Special requests', type: 'text', placeholder: 'Late check-in, gluten-free breakfast', required: false },
    ],
    buildInstructions: (v) => `You are calling ${v.hotel} to book a room for ${v.name}.
Check-in: ${v.checkIn}, check-out: ${v.checkOut}. Guests: ${v.guests}.${v.roomType && v.roomType !== 'No preference' ? ` Room type: ${v.roomType}.` : ''}
${v.notes ? `Special requests: ${v.notes}` : ''}
Ask for the total price and cancellation policy. If unavailable, ask for alternatives. Confirm the booking before ending the call.`,
    buildContext: (v) => `Book a room at ${v.hotel} for ${v.name}. Check-in ${v.checkIn}, check-out ${v.checkOut}, ${v.guests} guests.${v.roomType && v.roomType !== 'No preference' ? ` Room: ${v.roomType}.` : ''}${v.notes ? ` Requests: ${v.notes}` : ''} Ask for total price and cancellation policy. Confirm the booking before ending.`,
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: 'Pill',
    description: 'Check medication availability',
    fields: [
      { key: 'pharmacy', label: 'Pharmacy name', type: 'text', placeholder: 'Pharmacie du Centre', required: true },
      { key: 'medication', label: 'Medication', type: 'text', placeholder: 'Doliprane 1000mg', required: true },
      { key: 'quantity', label: 'Quantity', type: 'number', placeholder: '2 boxes', required: false },
      { key: 'name', label: 'Your name', type: 'text', placeholder: 'Raphaël Girard', required: false },
    ],
    buildInstructions: (v) => `You are calling ${v.pharmacy} to check if they have ${v.medication} in stock${v.quantity ? ` (quantity: ${v.quantity})` : ''}.
${v.name ? `The caller's name is ${v.name}.` : ''}
Ask if it's available, the price, and if they can hold it. Be concise and polite.`,
    buildContext: (v) => `Call ${v.pharmacy} to check if ${v.medication} is in stock${v.quantity ? ` (quantity: ${v.quantity})` : ''}.${v.name ? ` Caller: ${v.name}.` : ''} Ask for price and if they can hold it.`,
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: 'Phone',
    description: 'Describe your own call scenario',
    fields: [
      { key: 'name', label: 'Your name', type: 'text', placeholder: 'Raphaël Girard', required: false },
      { key: 'objective', label: 'What do you want the call to accomplish?', type: 'text', placeholder: 'Call my internet provider to ask why my speed dropped and request a fix', required: true },
      { key: 'notes', label: 'Extra details to mention', type: 'text', placeholder: 'Account number 123456, fiber plan 1GB', required: false },
    ],
    buildInstructions: (v) => `You are making a phone call on behalf of ${v.name || 'the user'}.
Objective: ${v.objective}
${v.notes ? `Additional details: ${v.notes}` : ''}
Stay focused on the objective. Ask follow-up questions if needed. Summarise the outcome before ending the call.`,
    buildContext: (v) => `Call on behalf of ${v.name || 'the user'}. Objective: ${v.objective}${v.notes ? `. Additional details: ${v.notes}` : ''}. Stay focused on the objective and summarise the outcome at the end.`,
  },
]

export function getTemplate(id: string): CallTemplate | undefined {
  return CALL_TEMPLATES.find(t => t.id === id)
}