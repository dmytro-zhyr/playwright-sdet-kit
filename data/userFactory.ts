import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

export interface NewUser {
  username: string;
  email: string;
  password: string;
}

// The target has no endpoint for deleting users, so every test account created here stays there
// forever. The qa_ prefix is what lets anyone looking at the data tell where it came from.
// See spec/FINDINGS.md, "Teardown limits".
const unique = (): string => faker.string.alphanumeric({ length: 10, casing: 'lower' });

export const userFactory = Factory.define<NewUser>('user')
  .attr('username', () => `qa_${unique()}`)
  .attr('email', () => `qa_${unique()}@example.com`)
  .attr('password', () => faker.internet.password({ length: 14 }));
