'use server';

import { revalidatePath } from 'next/cache';

export async function revalidateAfterTest(): Promise<void> {
  try {
    revalidatePath('/weakness');
    revalidatePath('/group');
    revalidatePath('/dashboard');
  } catch (err) {
    console.error('Failed to revalidate paths after test:', err);
  }
}
