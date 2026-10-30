import { NextResponse } from "next/server";
import { errMsg } from "@/lib/format";
import { createOrder } from "@/lib/paypal/client";

// Fixed on the server so the demo can never charge more than $0.15.
const DEMO_AMOUNT = "0.15";
const DEMO_NOTE = "Logo design for Sarah";

export async function POST() {
  try {
    const order = await createOrder(DEMO_AMOUNT, DEMO_NOTE);
    return NextResponse.json({ approveUrl: order.approveUrl });
  } catch (e) {
    console.error("[paypal] create-order failed", e);
    return NextResponse.json({ error: errMsg(e, "Could not start PayPal checkout") }, { status: 502 });
  }
}

