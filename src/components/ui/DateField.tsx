import { useState } from 'react';
import {
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type ViewStyle,
} from 'react-native';

import { TextField } from '@/components/ui/TextField';
import { parseTypedDate } from '@/lib/dates';

export const DATE_FORMAT_ERROR = 'Enter a date like 05/09/2026';

export interface DateFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  editable?: boolean;
  onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function DateField({
  label,
  value,
  onChangeText,
  error,
  editable = true,
  onBlur,
  containerStyle,
}: DateFieldProps) {
  const [blurError, setBlurError] = useState<string | undefined>(undefined);

  const handleChangeText = (nextText: string) => {
    if (blurError) {
      setBlurError(undefined);
    }
    onChangeText(nextText);
  };

  const handleBlur = (event: NativeSyntheticEvent<TargetedEvent>) => {
    const parsed = parseTypedDate(value);
    setBlurError(parsed === null ? DATE_FORMAT_ERROR : undefined);
    onBlur?.(event);
  };

  return (
    <TextField
      label={label}
      value={value}
      onChangeText={handleChangeText}
      onBlur={handleBlur}
      placeholder="DD/MM/YYYY"
      helperText="DD/MM/YYYY"
      error={error ?? blurError}
      keyboardType="numeric"
      maxLength={10}
      editable={editable}
      autoCorrect={false}
      autoCapitalize="none"
      returnKeyType="done"
      containerStyle={containerStyle}
    />
  );
}
