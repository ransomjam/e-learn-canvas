import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Printer, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentsService, Payment } from '@/services/payments.service';
import { useAuth } from '@/contexts/AuthContext';
import InvoiceCard from '@/components/common/InvoiceCard';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [paymentObj, setPaymentObj] = useState<Payment | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkPayment = async () => {
      const transId = searchParams.get('transId');
      if (!transId) {
        setStatus('failed');
        return;
      }

      try {
        const result = await paymentsService.checkFapshiPaymentStatus(transId);
        if (result.status === 'completed' || result.fapshiStatus === 'SUCCESSFUL') {
          // If successful, retrieve the full payment details to show the invoice
          if (result.paymentId) {
            try {
              const fullPayment = await paymentsService.getPaymentById(result.paymentId);
              setPaymentObj(fullPayment);
            } catch (err) {
              console.error('Failed to grab full payment for invoice:', err);
            }
          }
          setStatus('success');
        } else {
          setStatus('failed');
        }
      } catch {
        setStatus('failed');
      }
    };

    checkPayment();
  }, [searchParams]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4 py-12 print:bg-white print:p-0">
      <div className="w-full max-w-2xl mx-auto">
        
        {status === 'loading' && (
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verifying Payment...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between shadow-sm print:hidden">
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <CheckCircle className="w-12 h-12 text-green-500 flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-green-900">Payment Successful!</h2>
                  <p className="text-green-700 font-medium">Your course enrollment is confirmed.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="bg-white hover:bg-green-50 text-green-700 border-green-300" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Invoice
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => navigate('/my-courses')}>
                  Start Learning
                </Button>
              </div>
            </div>

            {paymentObj && user && (
              <div className="relative print:shadow-none print:border-none">
                <div className="absolute top-2 right-2 print:hidden">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')} className="text-muted-foreground hover:text-primary">
                    <FileText className="mr-2 h-4 w-4" />
                    View All Invoices
                  </Button>
                </div>
                <div ref={printRef} className="print:block">
                  <InvoiceCard payment={paymentObj} user={user} />
                </div>
              </div>
            )}
            
            {(!paymentObj || !user) && (
              <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm mt-6 print:hidden">
                <p className="text-muted-foreground mb-4">Invoice details are still loading...</p>
                <Button onClick={() => navigate('/my-courses')}>
                  Go to My Courses
                </Button>
              </div>
            )}
          </div>
        )}
        
        {status === 'failed' && (
          <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-6">
              Your payment could not be verified. Please try again.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Button onClick={() => navigate('/courses')} className="w-full sm:w-auto">
                Back to Courses
              </Button>
              <Button variant="outline" onClick={() => navigate('/my-courses')} className="w-full sm:w-auto">
                View My Courses
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
