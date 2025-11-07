"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Lock, Unlock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { encryptText, decryptText, validatePasswordStrength } from '@/lib/encryption';

type EncryptionDialogProps = {
  mode: 'encrypt' | 'decrypt';
  content: string;
  onResult: (result: string) => void;
  trigger?: React.ReactNode;
};

export default function EncryptionDialog({ mode, content, onResult, trigger }: EncryptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);

  const passwordStrength = validatePasswordStrength(password);

  const handleProcess = async () => {
    setError('');
    
    if (!password) {
      setError('Password is required');
      return;
    }

    if (mode === 'encrypt') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (passwordStrength.strength === 'weak') {
        setError('Password is too weak. Use at least 8 characters with numbers and special characters.');
        return;
      }
    }

    setProcessing(true);
    try {
      if (mode === 'encrypt') {
        const encrypted = encryptText(content, password);
        const result = JSON.stringify(encrypted); // Convert to string
        onResult(result);
      } else {
        // Parse the encrypted data
        try {
          const encryptedData = JSON.parse(content);
          const result = decryptText(
            encryptedData.encrypted,
            password,
            encryptedData.iv,
            encryptedData.salt
          );
          onResult(result);
        } catch {
          throw new Error('Invalid encrypted content format');
        }
      }
      
      setOpen(false);
      resetForm();
    } catch {
      setError(mode === 'encrypt' ? 'Encryption failed' : 'Decryption failed. Check your password.');
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setError('');
  };

  const getPasswordStrengthColor = () => {
    if (!password) return 'bg-gray-200';
    switch (passwordStrength.strength) {
      case 'weak': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'strong': return 'bg-green-500';
      default: return 'bg-gray-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            {mode === 'encrypt' ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Encrypt
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Decrypt
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'encrypt' ? 'Encrypt Content' : 'Decrypt Content'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            
            {/* Password Strength Indicator (only for encryption) */}
            {mode === 'encrypt' && password && (
              <div className="space-y-1">
                <div className="flex gap-1 h-1">
                  <div className={`flex-1 rounded-full ${getPasswordStrengthColor()}`} />
                  <div className={`flex-1 rounded-full ${passwordStrength.strength !== 'weak' ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                  <div className={`flex-1 rounded-full ${passwordStrength.strength === 'strong' ? getPasswordStrengthColor() : 'bg-gray-200'}`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Password strength: <span className="capitalize">{passwordStrength.strength}</span>
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password (only for encryption) */}
          {mode === 'encrypt' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-accent p-3 rounded-md">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              {mode === 'encrypt' 
                ? 'Your content will be encrypted using AES-256. Keep your password safe - it cannot be recovered if lost.'
                : 'Enter the password used to encrypt this content.'
              }
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleProcess} disabled={processing}>
            {processing ? (
              <>Processing...</>
            ) : (
              <>
                {mode === 'encrypt' ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Encrypt
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Decrypt
                  </>
                )}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
