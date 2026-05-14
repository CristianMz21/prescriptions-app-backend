/* Copyright (c) 2026. All rights reserved. */
import { customAlphabet } from 'nanoid';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 10;

const generate = customAlphabet(ALPHABET, CODE_LENGTH);

export const generatePrescriptionCode = (): string => `RX-${generate()}`;
