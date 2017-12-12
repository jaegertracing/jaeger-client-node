# Copyright (c) 2017 Uber Technologies, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied. See the License for the specific language governing permissions and limitations under
# the License.

# For thriftrw to work, include paths must be prefixed with ./ or ../
# This agent.thrift file is a copy of jaeger-idl/thrift/agent.thrift with
# a few alterations:
#
# 1) zipkin.thrift was completely removed given that jaeger-idl/thrift/zipkincore.thrift
#    doesn't conform to thriftrw specifications.
# 2) changed the path to jaeger.thrift
#
# Unfortunately, this file needs to be kept up to date manually.

include "../jaeger-idl/thrift/jaeger.thrift"

namespace java com.uber.jaeger.agent.thrift

service Agent {
    oneway void emitBatch(1: jaeger.Batch batch)
}
