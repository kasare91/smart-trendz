import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/customers
 * List all customers with optional search
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    const customers = await prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { phoneNumber: { contains: search } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: { orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customers
 * Create a new customer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, phoneNumber, email } = body;

    if (!fullName || !phoneNumber) {
      return NextResponse.json(
        { error: 'Full name and phone number are required' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.create({
      data: {
        fullName,
        phoneNumber,
        email: email || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
