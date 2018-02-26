// Copyright (c) 2016 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing permissions and limitations under
// the License.

import opentracing from 'opentracing';

//FORMAT_BINARY format represents SpanContexts in an opaque binary carrier.
export const FORMAT_BINARY = opentracing.FORMAT_BINARY;

//FORMAT_TEXT_MAP format represents SpanContexts using a string->string map (backed by a Javascript Object) as a carrier.
export const FORMAT_TEXT_MAP = opentracing.FORMAT_TEXT_MAP;

//FORMAT_HTTP_HEADERS format represents SpanContexts using a character-restricted string->string map (backed by a Javascript Object) as a carrier.
export const FORMAT_HTTP_HEADERS = opentracing.FORMAT_HTTP_HEADERS;
