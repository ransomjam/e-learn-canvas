import { forwardRef } from 'react';
import { format } from 'date-fns';
import { Payment } from '@/services/payments.service';
import { User } from '@/services/auth.service';
import Logo from '@/components/common/Logo';

interface InvoiceCardProps {
  payment: Payment;
  user: User;
}

const InvoiceCard = forwardRef<HTMLDivElement, InvoiceCardProps>(
  ({ payment, user }, ref) => {
    return (
      <div 
        ref={ref}
        className="bg-white text-gray-900 border border-gray-200 rounded-xl shadow-lg p-8 sm:p-10 container max-w-2xl mx-auto relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-cyan-500" />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <div className="flex items-center gap-3">
            <Logo size="md" className="h-10 w-10 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Cradema</h2>
              <p className="text-xs text-gray-500">Transforming Education in Africa</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <h1 className="text-3xl font-black text-gray-200 uppercase tracking-widest mb-1">INVOICE</h1>
            <p className="text-sm font-semibold text-gray-600">#{payment.transactionId?.toUpperCase() || payment.id.split('-')[0].toUpperCase()}</p>
            <p className="text-sm text-gray-500">{format(new Date(payment.paidAt || payment.createdAt), 'MMM dd, yyyy h:mm a')}</p>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-100 my-8" />

        {/* Billing Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Billed To</p>
            <p className="font-semibold text-gray-900 text-lg">{user.firstName} {user.lastName}</p>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Payment Method</p>
            <p className="font-semibold text-gray-900 text-lg capitalize">{payment.paymentMethod || 'Mobile Money'}</p>
            <div className="inline-block px-3 py-1 bg-green-50 text-green-700 text-xs font-bold uppercase rounded-full mt-2 ring-1 ring-green-600/20">
              {payment.status === 'completed' ? 'Paid Successfully' : payment.status}
            </div>
          </div>
        </div>

        {/* Course Details Table */}
        <div className="bg-gray-50 rounded-lg p-6 mb-8 border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Description</p>
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="font-semibold text-gray-900 text-base">{payment.course.title}</p>
              <p className="text-sm text-gray-500">Course Enrollment</p>
            </div>
            <p className="font-bold text-gray-900">
              {(payment.amount).toLocaleString()} {payment.currency}
            </p>
          </div>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-1/2">
            <div className="flex justify-between py-2 text-sm text-gray-600">
              <p>Subtotal</p>
              <p>{(payment.amount).toLocaleString()} {payment.currency}</p>
            </div>
            <div className="flex justify-between py-2 text-sm text-gray-600 border-b border-gray-200">
              <p>Tax (0%)</p>
              <p>0 {payment.currency}</p>
            </div>
            <div className="flex justify-between py-4">
              <p className="text-lg font-bold text-gray-900">Total Paid</p>
              <p className="text-xl font-black text-blue-600">
                {(payment.amount).toLocaleString()} {payment.currency}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="text-sm font-medium text-gray-600 mb-1">Thank you for learning with Cradema!</p>
          <p className="text-xs text-gray-400">If you have any questions about this invoice, please contact support@cradema.com.</p>
        </div>
      </div>
    );
  }
);

InvoiceCard.displayName = 'InvoiceCard';
export default InvoiceCard;
