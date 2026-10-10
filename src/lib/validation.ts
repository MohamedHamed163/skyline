// Field rules shared by server actions and client forms, so both reject the same input.
export const validPhone = (phone: string) => /^\+?[\d\s()-]{8,20}$/.test(phone);

export const validEmail = (email: string) => /^\S+@\S+\.\S+$/.test(email);
