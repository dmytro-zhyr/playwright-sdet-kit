import { Factory } from 'rosie';
import { faker } from '@faker-js/faker';

// Named for its place on the wire: the value `POST /users` carries under `user`. Not the request
// and not the body — the body is `{ user: … }`, and that wrapping is added at the call site.
// `Create` is in the name because the specification also has `PUT /user`, whose input is a
// different shape; leaving the operation unsaid would give this one the general slot.
export interface UserCreateInput {
  username: string;
  email: string;
  password: string;
}

// What `POST /users/login` carries under `user` — a projection of the shape above rather than a
// restatement of two of its fields, so the two cannot drift apart.
export type Credentials = Pick<UserCreateInput, 'email' | 'password'>;

// The target has no endpoint for deleting users, so every test account created here stays there
// forever. The qa_ prefix is what lets anyone looking at the data tell where it came from.
// See spec/FINDINGS.md, "Teardown limits".
const unique = (): string => faker.string.alphanumeric({ length: 10, casing: 'lower' });

export const userFactory = Factory.define<UserCreateInput>('user')
  .attr('username', () => `qa_${unique()}`)
  .attr('email', () => `qa_${unique()}@example.com`)
  .attr('password', () => faker.internet.password({ length: 14 }));
