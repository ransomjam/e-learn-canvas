import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { paymentsService } from '@/services/payments.service';

const PaymentCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verifying Payment...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment.</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-6">You have been enrolled in the course.</p>
            <Button onClick={() => navigate('/my-courses')} className="w-full">
              Go to My Courses
            </Button>
          </>
        )}
        
        {status === 'failed' && (
          <>
            <XCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Failed</h2>
            <p className="text-muted-foreground mb-6">
              Your payment could not be verified. Please try again.
            </p>
            <div className="space-y-2">
              <Button onClick={() => navigate('/courses')} className="w-full">
                Back to Courses
              </Button>
              <Button variant="outline" onClick={() => navigate('/my-courses')} className="w-full">
                View My Courses
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentCallback;
