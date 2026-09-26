import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useAuth, HOME_ROUTE } from '../hooks/useAuth';
import { LogIn, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Ogiltig e-postadress'),
  password: z.string().min(1, 'Ange lösenord'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const requested = (location.state as { from?: string } | null)?.from;
  const from = requested && requested !== '/login' ? requested : undefined;

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    const profile = await signIn(data.email, data.password);
    if (profile) {
      navigate(from ?? HOME_ROUTE[profile.role], { replace: true });
    }
    setIsLoading(false);
  };

  // Already logged in - skip the form.
  if (!authLoading && user?.is_active && !isLoading) {
    return <Navigate to={from ?? HOME_ROUTE[user.role]} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="inline-block p-3 bg-blue-100 rounded-full mb-4"
          >
            <LogIn className="w-8 h-8 text-blue-600" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Godsmotagning Logistik
          </h1>
          <p className="text-gray-600">Logga in för att fortsätta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              E-postadress
            </label>
            <input
              {...register('email')}
              id="login-email"
              type="email"
              autoComplete="username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="din.email@exempel.se"
            />
            {errors.email && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm mt-1"
              >
                {errors.email.message}
              </motion.p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
              Lösenord
            </label>
            <input
              {...register('password')}
              id="login-password"
              type="password"
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="••••••••"
            />
            {errors.password && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm mt-1"
              >
                {errors.password.message}
              </motion.p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Loggar in...
              </>
            ) : (
              <>
                <LogIn size={20} />
                Logga in
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Kontakta administratören för hjälp</p>
        </div>
      </motion.div>
    </div>
  );
}
