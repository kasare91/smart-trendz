import React from 'react';
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { BusinessProfile, Customer, Order, Payment } from '@prisma/client';
import { DEFAULT_BUSINESS_NAME } from '@/lib/business-profile';

export type OrderReceipt = Order & {
  customer: Customer;
  payments: Payment[];
};

export type OrderWithRelations = OrderReceipt;

type OrderReceiptPDFProps = {
  order: OrderWithRelations;
  businessProfile: BusinessProfile | null;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getAddress(profile: BusinessProfile | null): string {
  return [profile?.address, profile?.city, profile?.country].filter(Boolean).join(', ');
}

export function OrderReceiptPDF({
  order,
  businessProfile,
}: OrderReceiptPDFProps) {
  const brandColor = businessProfile?.brandColor || '#0ea5e9';
  const businessName = businessProfile?.businessName || DEFAULT_BUSINESS_NAME;
  const currency = businessProfile?.currency || 'GHS';
  const totalPaid = order.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = order.totalAmount - totalPaid;
  const address = getAddress(businessProfile);
  const styles = createStyles(brandColor);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.businessBlock}>
            {businessProfile?.logoUrl ? (
              <Image src={businessProfile.logoUrl} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.businessName}>{businessName}</Text>
              {address ? <Text style={styles.headerMutedText}>{address}</Text> : null}
              {businessProfile?.phoneNumber ? (
                <Text style={styles.headerMutedText}>{businessProfile.phoneNumber}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.receiptHeader}>
          <View>
            <Text style={styles.title}>ORDER RECEIPT</Text>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{order.status.replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text style={styles.bodyText}>{order.customer.fullName}</Text>
            <Text style={styles.bodyText}>{order.customer.phoneNumber}</Text>
            {order.customer.email ? <Text style={styles.bodyText}>{order.customer.email}</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order details</Text>
            <Text style={styles.bodyText}>Description: {order.description}</Text>
            {order.garmentType ? <Text style={styles.bodyText}>Garment type: {order.garmentType}</Text> : null}
            {order.fabricType ? <Text style={styles.bodyText}>Fabric type: {order.fabricType}</Text> : null}
            <Text style={styles.bodyText}>Order date: {formatDate(order.orderDate)}</Text>
            <Text style={styles.bodyText}>Due date: {formatDate(order.dueDate)}</Text>
            <Text style={styles.bodyText}>Status: {order.status.replace('_', ' ')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableDate}>Date</Text>
              <Text style={styles.tableMethod}>Method</Text>
              <Text style={styles.tableAmount}>Amount</Text>
            </View>
            {order.payments.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.emptyPayments}>No payments recorded</Text>
              </View>
            ) : (
              order.payments.map((payment) => (
                <View key={payment.id} style={styles.tableRow}>
                  <Text style={styles.tableDate}>{formatDate(payment.paymentDate)}</Text>
                  <Text style={styles.tableMethod}>{payment.paymentMethod}</Text>
                  <Text style={styles.tableAmount}>{formatCurrency(payment.amount, currency)}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Total amount</Text>
            <Text>{formatCurrency(order.totalAmount, currency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Total paid</Text>
            <Text>{formatCurrency(totalPaid, currency)}</Text>
          </View>
          <View style={styles.summaryTotalRow}>
            <Text>Balance due</Text>
            <Text style={balance > 0 ? styles.balanceDue : styles.balanceClear}>
              {formatCurrency(balance, currency)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          {businessProfile?.receiptFooterNote ? (
            <Text style={styles.footerNote}>{businessProfile.receiptFooterNote}</Text>
          ) : null}
          <Text style={styles.mutedText}>Generated {formatDate(new Date())}</Text>
        </View>
      </Page>
    </Document>
  );
}

function createStyles(brandColor: string) {
  return StyleSheet.create({
    page: {
      padding: 36,
      fontFamily: 'Helvetica',
      color: '#111827',
      fontSize: 10,
    },
    header: {
      backgroundColor: brandColor,
      color: '#ffffff',
      padding: 16,
      borderRadius: 4,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    businessBlock: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    logo: {
      width: 52,
      height: 52,
      objectFit: 'contain',
    },
    businessName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 4,
    },
    headerMutedText: {
      color: '#e0f2fe',
      lineHeight: 1.5,
    },
    mutedText: {
      color: '#6b7280',
      lineHeight: 1.5,
    },
    divider: {
      marginVertical: 18,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
    },
    receiptHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    orderNumber: {
      color: '#6b7280',
      marginTop: 3,
    },
    statusBadge: {
      backgroundColor: brandColor,
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    statusText: {
      color: '#ffffff',
      fontSize: 9,
      fontWeight: 'bold',
    },
    twoColumn: {
      flexDirection: 'row',
      gap: 24,
      marginBottom: 20,
    },
    section: {
      flexGrow: 1,
      flexBasis: 0,
      marginBottom: 18,
    },
    sectionTitle: {
      color: brandColor,
      fontSize: 11,
      fontWeight: 'bold',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    bodyText: {
      marginBottom: 4,
      lineHeight: 1.45,
    },
    table: {
      borderWidth: 1,
      borderColor: '#e5e7eb',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#f3f4f6',
      padding: 8,
      fontWeight: 'bold',
    },
    tableRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      padding: 8,
    },
    tableDate: {
      width: '34%',
    },
    tableMethod: {
      width: '33%',
    },
    tableAmount: {
      width: '33%',
      textAlign: 'right',
    },
    emptyPayments: {
      width: '100%',
      color: '#6b7280',
      textAlign: 'center',
    },
    summary: {
      marginLeft: 'auto',
      width: 220,
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      paddingTop: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    summaryTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      paddingTop: 8,
      fontWeight: 'bold',
    },
    balanceDue: {
      color: '#dc2626',
      fontWeight: 'bold',
    },
    balanceClear: {
      color: '#059669',
      fontWeight: 'bold',
    },
    footer: {
      position: 'absolute',
      left: 36,
      right: 36,
      bottom: 28,
      textAlign: 'center',
    },
    footerNote: {
      marginBottom: 4,
      color: '#374151',
    },
  });
}

export default OrderReceiptPDF;
