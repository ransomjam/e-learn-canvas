import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Printer, ArrowRight, Eye, Download } from 'lucide-react';
import { format } from 'date-fns';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { paymentsService, Payment } from '@/services/payments.service';
import { useAuth } from '@/contexts/AuthContext';
import InvoiceCard from '@/components/common/InvoiceCard';
import ParticleLoader from '@/components/ui/ParticleLoader';

// Currency display helper
const CURRENCY_SYMBOLS: Record<string, string> = {
  XAF: 'FCFA', USD: '$', EUR: '€', GBP: '£',
  NGN: '₦', GHS: '₵', KES: 'KSh', ZAR: 'R',
};
const fmtCurrency = (amt: number, code: string) =>
  `${CURRENCY_SYMBOLS[code] || code} ${amt.toLocaleString()}`;

const Invoices = () => {
  const { user } = useAuth();
  const [selectedInvoice, setSelectedInvoice] = useState<Payment | null>(null);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['myPayments'],
    queryFn: paymentsService.getMyPayments,
  });

  const completedPayments = payments.filter((p: Payment) => p.status === 'completed');

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <Layout>
      <div className="py-8 sm:py-12 bg-secondary/20 min-h-screen">
        <div className="container mx-auto px-4 max-w-5xl">

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl flex items-center gap-2">
                <FileText className="text-primary h-8 w-8" />
                My Invoices
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                View and download past receipts for your course enrollments.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <ParticleLoader size={40} />
            </div>
          ) : completedPayments.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground shadow-sm">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-foreground">No invoices found</p>
              <p className="text-sm">You haven't made any successful payments yet.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-secondary/50 text-muted-foreground uppercase text-xs font-semibold">
                    <tr>
                      <th className="px-6 py-4">Invoice ID</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Course</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {completedPayments.map((payment: Payment) => (
                      <tr key={payment.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-4 font-medium text-foreground">
                          #{payment.transactionId?.toUpperCase() || payment.id.split('-')[0].toUpperCase()}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {format(new Date(payment.paidAt || payment.createdAt), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 font-medium text-foreground">
                          {payment.course.title}
                        </td>
                        <td className="px-6 py-4 font-semibold text-primary">
                          {fmtCurrency(payment.amount, payment.currency)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="inline-flex gap-2"
                                onClick={() => setSelectedInvoice(payment)}
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none print:shadow-none print:m-0 print:p-0">
                              <div className="bg-white/95 p-4 rounded-xl backdrop-blur flex flex-col gap-4">
                                <div className="flex justify-end gap-2 print:hidden px-4 pt-2">
                                  <Button variant="outline" className="bg-white" onClick={handlePrint}>
                                    <Printer className="mr-2 h-4 w-4" /> Print
                                  </Button>
                                  {/* Download functionally is same as print: Save to PDF */}
                                  <Button className="bg-primary text-white" onClick={handlePrint}>
                                    <Download className="mr-2 h-4 w-4" /> Download PDF
                                  </Button>
                                </div>
                                <div className="print:block" id="printable-invoice">
                                  {user && selectedInvoice && (
                                    <div className="transform scale-[0.85] sm:scale-100 origin-top">
                                      <InvoiceCard payment={selectedInvoice} user={user} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default Invoices;
