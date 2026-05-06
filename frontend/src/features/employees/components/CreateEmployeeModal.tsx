import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Mail, Lock } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useCreateEmployee } from '../hooks/useCreateEmployee'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
}

export default function CreateEmployeeModal({ open, onClose }: Props) {
  const createEmployee = useCreateEmployee(onClose)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onSubmit = handleSubmit(async (data) => {
    await createEmployee.mutateAsync(data)
    reset()
  })

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add New Employee"
      description="Create a new employee account. They will be able to log in immediately."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-employee-form"
            loading={isSubmitting || createEmployee.isPending}
          >
            Create Employee
          </Button>
        </>
      }
    >
      <form id="create-employee-form" onSubmit={onSubmit} className="space-y-4">
        {/* Server error */}
        {createEmployee.isError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-600">
              {(createEmployee.error as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? 'Something went wrong. Please try again.'}
            </p>
          </div>
        )}

        <Input
          label="Full Name"
          placeholder="Jane Smith"
          leftIcon={<User size={16} />}
          error={errors.name?.message}
          {...register('name')}
        />
        <Input
          label="Email Address"
          type="email"
          placeholder="jane@company.com"
          leftIcon={<Mail size={16} />}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          placeholder="Minimum 6 characters"
          leftIcon={<Lock size={16} />}
          error={errors.password?.message}
          {...register('password')}
        />
      </form>
    </Modal>
  )
}
